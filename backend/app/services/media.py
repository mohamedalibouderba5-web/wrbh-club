"""Stockage médias durable (Postgres) + URLs signées TTL."""
from __future__ import annotations

import hashlib
import hmac
import io
import time
import uuid

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import MediaObject

# Limite stockage DB (avatars)
MAX_STORE_BYTES = 2 * 1024 * 1024
MEDIA_SIGN_TTL_SEC = 60 * 60 * 12  # 12 h


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
    """Chemin stable stocké en base (sans signature)."""
    return f"/api/v1/media/{media_id}"


def _media_sig(media_id: str, exp: int) -> str:
    secret = get_settings().secret_key.encode("utf-8")
    msg = f"{media_id}.{exp}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()[:40]


def signed_media_path(media_id: str, ttl_sec: int = MEDIA_SIGN_TTL_SEC) -> str:
    exp = int(time.time()) + ttl_sec
    sig = _media_sig(media_id, exp)
    return f"/api/v1/media/{media_id}?exp={exp}&sig={sig}"


def verify_media_signature(media_id: str, exp: int | None, sig: str | None) -> bool:
    if not exp or not sig:
        return False
    try:
        exp_i = int(exp)
    except (TypeError, ValueError):
        return False
    if exp_i < int(time.time()):
        return False
    expected = _media_sig(media_id, exp_i)
    return hmac.compare_digest(expected, sig)


def extract_media_id(path: str | None) -> str | None:
    if not path:
        return None
    # /api/v1/media/{id} or full URL
    part = path.split("?")[0].rstrip("/").split("/")[-1]
    if part and all(c in "0123456789abcdef" for c in part.lower()) and len(part) >= 16:
        return part
    return None


def enrich_media_path(path: str | None) -> str | None:
    """Réécrit un chemin média stocké en URL signée pour l’affichage client."""
    mid = extract_media_id(path)
    if mid:
        return signed_media_path(mid)
    return path
