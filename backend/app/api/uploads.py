from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.core.roles import Role
from app.models import Athlete, Attachment, Registration, User

router = APIRouter(prefix="/uploads", tags=["uploads"])
settings = get_settings()

ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_BYTES = 8 * 1024 * 1024


def _save_upload(file: UploadFile, subdir: str) -> str:
    if file.content_type and file.content_type not in ALLOWED:
        raise HTTPException(400, "Format image non supporté (jpg/png/webp)")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "Image trop volumineuse (max 8 Mo)")
    if not data:
        raise HTTPException(400, "Fichier vide")
    ext = Path(file.filename or "photo.jpg").suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"
    folder = Path(settings.upload_dir) / subdir
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    path = folder / name
    path.write_bytes(data)
    return f"/uploads/{subdir}/{name}"


@router.post("/photo")
async def upload_photo(
    file: UploadFile = File(...),
    athlete_id: int | None = None,
    registration_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION, Role.STAFF, Role.COACH, Role.PARENT)),
):
    rel = _save_upload(file, "photos")
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
    return {"path": rel, "url": rel}
