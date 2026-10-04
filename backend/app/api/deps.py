import time
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.roles import Role
from app.core.security import TokenError, safe_decode
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Routes autorisées tant que must_change_password=True
_PWD_CHANGE_ALLOW = {
    "/api/v1/auth/change-password",
    "/api/v1/auth/me",
    "/api/v1/system/wake",
}

# Throttle présence (évite un UPDATE à chaque requête)
_LAST_SEEN_TOUCH: dict[int, float] = {}
_LAST_SEEN_MIN_INTERVAL = 120.0  # secondes


def _touch_last_seen(db: Session, user: User) -> None:
    now = time.time()
    prev = _LAST_SEEN_TOUCH.get(user.id, 0.0)
    if now - prev < _LAST_SEEN_MIN_INTERVAL:
        return
    user.last_seen_at = datetime.now(timezone.utc)
    try:
        db.commit()
        _LAST_SEEN_TOUCH[user.id] = now
    except Exception:
        db.rollback()


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = safe_decode(token)
    except TokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")
    user = db.get(User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur inactif")
    if getattr(user, "must_change_password", False):
        path = request.url.path.rstrip("/") or "/"
        if path not in _PWD_CHANGE_ALLOW and not path.endswith("/auth/change-password"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Changement de mot de passe obligatoire avant toute autre action",
            )
    _touch_last_seen(db, user)
    return user


def require_roles(*roles: Role | str):
    allowed = {str(r) for r in roles}

    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed and user.role != Role.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission refusée")
        return user

    return _dep
