"""API feedback : collecteur d'erreurs auto + réclamations utilisateur."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.roles import Role
from app.core.security import TokenError, safe_decode
from app.models import SystemFeedbackEvent, User
from app.services.feedback_store import append_event, jsonl_path, read_recent

router = APIRouter(prefix="/feedback", tags=["feedback"])
_oauth_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_optional_user(
    token: str | None = Depends(_oauth_optional),
    db: Session = Depends(get_db),
) -> User | None:
    if not token:
        return None
    try:
        payload = safe_decode(token)
    except TokenError:
        return None
    uid = payload.get("sub")
    if not uid:
        return None
    try:
        user = db.get(User, int(uid))
    except (TypeError, ValueError):
        return None
    if not user or not user.is_active:
        return None
    return user


class FeedbackEventIn(BaseModel):
    kind: str = Field(default="auto_error", max_length=40)
    source: str = Field(default="web", max_length=40)
    severity: str = Field(default="error", max_length=20)
    target: Optional[str] = Field(default=None, max_length=120)
    message: str = Field(min_length=1, max_length=4000)
    stack: Optional[str] = Field(default=None, max_length=8000)
    page_url: Optional[str] = Field(default=None, max_length=500)
    meta: dict[str, Any] = Field(default_factory=dict)


class UserReportIn(BaseModel):
    target: str = Field(min_length=1, max_length=120)
    target_label: Optional[str] = Field(default=None, max_length=200)
    report_type: str = Field(default="bug", max_length=40)  # bug | idea | other
    message: str = Field(min_length=3, max_length=4000)
    page_url: Optional[str] = Field(default=None, max_length=500)
    meta: dict[str, Any] = Field(default_factory=dict)


@router.post("/events")
def post_auto_event(
    payload: FeedbackEventIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Collecte automatique (erreurs JS, API, réseau…). Auth optionnelle."""
    rec = {
        "kind": payload.kind if payload.kind in {"auto_error", "api_error", "network"} else "auto_error",
        "source": payload.source or "web",
        "severity": payload.severity or "error",
        "target": payload.target,
        "message": payload.message,
        "stack": payload.stack,
        "page_url": payload.page_url or str(request.headers.get("referer") or ""),
        "user_id": user.id if user else None,
        "club_id": getattr(user, "club_id", None) if user else None,
        "role": user.role if user else None,
        "meta": {
            **(payload.meta or {}),
            "client_ip": (request.client.host if request.client else None),
            "user_agent": request.headers.get("user-agent"),
        },
    }
    saved = append_event(rec, db=db)
    return {"ok": True, "id": saved.get("id"), "ts": saved.get("ts")}


@router.post("/report")
def post_user_report(
    payload: UserReportIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Réclamation / proposition utilisateur (bouton Feedback)."""
    rec = {
        "kind": "user_report",
        "source": "web",
        "severity": "info" if payload.report_type == "idea" else "user",
        "target": payload.target,
        "message": payload.message,
        "page_url": payload.page_url,
        "user_id": user.id,
        "club_id": getattr(user, "club_id", None),
        "role": user.role,
        "meta": {
            **(payload.meta or {}),
            "report_type": payload.report_type,
            "target_label": payload.target_label,
            "user_agent": request.headers.get("user-agent"),
        },
    }
    saved = append_event(rec, db=db)
    return {"ok": True, "id": saved.get("id"), "ts": saved.get("ts")}


@router.get("/events")
def list_events(
    limit: int = Query(100, ge=1, le=500),
    since: Optional[str] = None,
    kind: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
):
    """Liste récente (DB prioritaire, fallback fichier JSONL)."""
    club_id = getattr(user, "club_id", None)
    q = db.query(SystemFeedbackEvent)
    if club_id:
        q = q.filter(
            or_(
                SystemFeedbackEvent.club_id == club_id,
                SystemFeedbackEvent.club_id.is_(None),
            )
        )
    q = q.order_by(SystemFeedbackEvent.id.desc())
    if kind:
        q = q.filter(SystemFeedbackEvent.kind == kind)
    if since:
        try:
            dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            q = q.filter(SystemFeedbackEvent.created_at >= dt)
        except ValueError:
            pass
    rows = q.limit(limit).all()
    if rows:
        return [
            {
                "id": r.id,
                "ts": r.created_at.isoformat() if r.created_at else None,
                "kind": r.kind,
                "source": r.source,
                "severity": r.severity,
                "target": r.target,
                "message": r.message,
                "stack": r.stack,
                "page_url": r.page_url,
                "user_id": r.user_id,
                "club_id": r.club_id,
                "role": r.role,
                "meta": r.meta_json,
            }
            for r in rows
        ]
    # Fallback fichier local (dev / avant première synchro DB)
    file_rows = list(reversed(read_recent(limit=limit, since_iso=since)))
    if club_id:
        file_rows = [
            event
            for event in file_rows
            if event.get("club_id") in (None, club_id)
        ]
    if kind:
        file_rows = [e for e in file_rows if e.get("kind") == kind]
    return file_rows


@router.get("/export")
def export_jsonl(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.DIRECTION)),
):
    """Export JSONL depuis la DB, avec fallback fichier pour les anciennes entrées."""
    club_id = getattr(user, "club_id", None)
    q = db.query(SystemFeedbackEvent)
    if club_id:
        q = q.filter(
            or_(
                SystemFeedbackEvent.club_id == club_id,
                SystemFeedbackEvent.club_id.is_(None),
            )
        )
    rows = q.order_by(SystemFeedbackEvent.id.desc()).limit(5000).all()
    if rows:
        records = [
            {
                "id": row.id,
                "ts": row.created_at.isoformat() if row.created_at else None,
                "kind": row.kind,
                "source": row.source,
                "severity": row.severity,
                "target": row.target,
                "message": row.message,
                "stack": row.stack,
                "page_url": row.page_url,
                "user_id": row.user_id,
                "club_id": row.club_id,
                "role": row.role,
                "meta": row.meta_json,
            }
            for row in rows
        ]
        text = "\n".join(json.dumps(record, ensure_ascii=False) for record in records)
        return {"source": "database", "content": text, "lines": len(records)}

    path = jsonl_path()
    if not path.exists():
        return {"source": "file", "path": str(path), "content": "", "lines": 0}
    lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if club_id:
        filtered: list[str] = []
        for line in lines:
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("club_id") in (None, club_id):
                filtered.append(line)
        lines = filtered
    text = "\n".join(lines)
    return {
        "source": "file",
        "path": str(path),
        "content": text,
        "lines": len(lines),
    }
