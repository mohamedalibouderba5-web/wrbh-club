from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.core.roles import Role
from app.models import Athlete, Attachment, MediaObject, Registration, User
from app.services.media import media_public_path, store_photo_bytes

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


@router.post("/uploads/photo")
async def upload_photo(
    file: UploadFile = File(...),
    athlete_id: int | None = None,
    registration_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH, Role.PARENT)),
):
    """Enregistre la photo en base (durable) + chemin /api/v1/media/{id}."""
    data, ctype = _read_upload(file)
    try:
        media = store_photo_bytes(db, data, content_type=ctype, filename=file.filename)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    rel = media_public_path(media.id)

    # Compat : aussi écrire sur disque local si possible (dev)
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
    return {"path": rel, "url": rel, "media_id": media.id, "storage": "database"}


@router.get("/media/{media_id}")
def get_media(media_id: str, db: Session = Depends(get_db)):
    """Public : sert les photos stockées en base (CDN alternatif simple)."""
    row = db.get(MediaObject, media_id)
    if not row:
        raise HTTPException(404, "Média introuvable")
    return Response(
        content=row.data,
        media_type=row.content_type or "image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )
