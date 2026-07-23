"""Stockage médias durable (Postgres) pour survivre au disque éphémère Render."""
from __future__ import annotations

import io
import uuid

from sqlalchemy.orm import Session

from app.models import MediaObject

# Limite stockage DB (avatars)
MAX_STORE_BYTES = 2 * 1024 * 1024


def _maybe_downscale(data: bytes, content_type: str) -> tuple[bytes, str]:
    """Réduit les JPEG/PNG si Pillow est dispo ; sinon renvoie tel quel."""
    try:
        from PIL import Image  # type: ignore
    except Exception:
        return data, content_type
    try:
        img = Image.open(io.BytesIO(data))
        img = img.convert("RGB")
        img.thumbnail((960, 960))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        return data, content_type


def store_photo_bytes(
    db: Session,
    data: bytes,
    *,
    content_type: str = "image/jpeg",
    filename: str | None = None,
) -> MediaObject:
    if not data:
        raise ValueError("Fichier vide")
    data, content_type = _maybe_downscale(data, content_type)
    if len(data) > MAX_STORE_BYTES:
        raise ValueError("Image trop volumineuse après compression (max 2 Mo)")
    media_id = uuid.uuid4().hex
    row = MediaObject(
        id=media_id,
        content_type=content_type or "image/jpeg",
        filename=filename,
        data=data,
        byte_size=len(data),
        kind="photo",
    )
    db.add(row)
    db.flush()
    return row


def media_public_path(media_id: str) -> str:
    return f"/api/v1/media/{media_id}"
