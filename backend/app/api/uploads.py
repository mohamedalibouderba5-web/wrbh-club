from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.core.roles import Role, STAFF_ROLES
from app.core.security import TokenError, safe_decode
from app.models import Athlete, Attachment, MediaObject, ParentChild, Registration, User
from app.services.media import (
    extract_media_id,
    media_public_path,
    store_photo_bytes,
    verify_media_signature,
)

router = APIRouter(tags=["uploads"])
settings = get_settings()

ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_BYTES = 8 * 1024 * 1024


def _read_upload(file: UploadFile) -> tuple[bytes, str]:
    if file.content_type and file.content_type not in ALLOWED:
        raise HTTPException(400, "Format image non supporté (jpg/png/webp)")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "Image trop volumineuse (max 8 Mo)")
    if not data:
        raise HTTPException(400, "Fichier vide")
    ctype = file.content_type or "image/jpeg"
    return data, ctype


def _parent_athlete_ids(db: Session, user: User) -> set[int]:
    rows = db.query(ParentChild.athlete_id).filter(ParentChild.parent_id == user.id).all()
    return {r[0] for r in rows}


def _assert_upload_target(db: Session, user: User, athlete_id: int | None, registration_id: int | None) -> None:
    if user.role in STAFF_ROLES or user.role == Role.COACH:
        return
    if user.role != Role.PARENT:
        raise HTTPException(403, "Permission refusée")
    allowed = _parent_athlete_ids(db, user)
    if athlete_id is not None and athlete_id not in allowed:
        raise HTTPException(403, "Photo : athlète non lié à votre compte")
    if registration_id is not None:
        reg = db.get(Registration, registration_id)
        if not reg or reg.athlete_id not in allowed:
            raise HTTPException(403, "Photo : inscription non autorisée")


def _user_can_view_media(db: Session, user: User, media_id: str) -> bool:
    if user.role in STAFF_ROLES or user.role == Role.COACH:
        return True
    if user.role == Role.PARENT:
        ids = _parent_athlete_ids(db, user)
        if not ids:
            return False
        athletes = db.query(Athlete).filter(Athlete.id.in_(ids)).all()
        for a in athletes:
            if extract_media_id(a.photo_path) == media_id:
                return True
        att = (
            db.query(Attachment.id)
            .filter(Attachment.athlete_id.in_(ids), Attachment.path.contains(media_id))
            .first()
        )
        return att is not None
    return False


def _resolve_media_user(
    db: Session,
    authorization: str | None,
    access_token: str | None,
) -> User | None:
    raw = None
    if authorization and authorization.lower().startswith("bearer "):
        raw = authorization.split(" ", 1)[1].strip()
    elif access_token:
        raw = access_token.strip()
    if not raw:
        return None
    try:
        payload = safe_decode(raw)
    except TokenError:
        return None
    uid = payload.get("sub")
    if not uid:
        return None
    user = db.get(User, int(uid))
    if not user or not user.is_active:
        return None
    return user


@router.post("/uploads/photo")
async def upload_photo(
    file: UploadFile = File(...),
    athlete_id: int | None = None,
    registration_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH, Role.PARENT)),
):
    """Enregistre la photo en base (durable) + chemin /api/v1/media/{id}."""
    _assert_upload_target(db, user, athlete_id, registration_id)
    data, ctype = _read_upload(file)
    try:
        media = store_photo_bytes(db, data, content_type=ctype, filename=file.filename)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    rel = media_public_path(media.id)

    if not settings.is_production:
        try:
            ext = Path(file.filename or "photo.jpg").suffix.lower() or ".jpg"
            if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
                ext = ".jpg"
            folder = Path(settings.upload_dir) / "photos"
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f"{media.id}{ext}").write_bytes(data)
        except Exception:
            pass

    if athlete_id:
        athlete = db.get(Athlete, athlete_id)
        if not athlete:
            raise HTTPException(404, "Athlète introuvable")
        athlete.photo_path = rel
    if registration_id:
        reg = db.get(Registration, registration_id)
        if not reg:
            raise HTTPException(404, "Inscription introuvable")
        athlete = db.get(Athlete, reg.athlete_id)
        if athlete:
            athlete.photo_path = rel
    db.add(
        Attachment(
            athlete_id=athlete_id,
            registration_id=registration_id,
            filename=file.filename or "photo.jpg",
            path=rel,
            kind="photo",
            uploaded_by=user.id,
        )
    )
    db.commit()
    from app.services.media import signed_media_path

    signed = signed_media_path(media.id)
    return {"path": rel, "url": signed, "media_id": media.id, "storage": "database"}


@router.get("/media/{media_id}")
def get_media(
    media_id: str,
    exp: int | None = Query(None),
    sig: str | None = Query(None),
    access_token: str | None = Query(None),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    """Médias privés : JWT (header/query) ou URL signée TTL."""
    row = db.get(MediaObject, media_id)
    if not row:
        raise HTTPException(404, "Média introuvable")

    allowed = False
    if verify_media_signature(media_id, exp, sig):
        allowed = True
    else:
        user = _resolve_media_user(db, authorization, access_token)
        if user and _user_can_view_media(db, user, media_id):
            allowed = True

    if not allowed:
        raise HTTPException(401, "Authentification requise pour ce média")

    return Response(
        content=row.data,
        media_type=row.content_type or "image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )
