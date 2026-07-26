"""Collecteur central d'erreurs / feedback utilisateur.

Persistance double :
- fichier JSONL du dépôt : data/system_feedback.jsonl (lisible par l'agent)
- table Postgres system_feedback_events (durable en production Render)
"""
from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

_lock = threading.Lock()

# backend/app/services → parents[3] = racine du monorepo
_REPO_ROOT = Path(__file__).resolve().parents[3]
_DATA_DIR = _REPO_ROOT / "data"
_JSONL = _DATA_DIR / "system_feedback.jsonl"
_LATEST_MD = _DATA_DIR / "ERROR_FEEDBACK_LATEST.md"
_MAX_MD_LINES = 80


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_dirs() -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)


def append_event(record: dict[str, Any], db: Session | None = None) -> dict[str, Any]:
    """Écrit un événement (auto erreur ou rapport utilisateur)."""
    payload = dict(record)
    payload.setdefault("ts", _now_iso())
    payload.setdefault("kind", "auto_error")
    payload.setdefault("source", "unknown")

    line = json.dumps(payload, ensure_ascii=False, default=str)

    with _lock:
        _ensure_dirs()
        with _JSONL.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
        _refresh_latest_md()

    if db is not None:
        try:
            from app.models import SystemFeedbackEvent

            row = SystemFeedbackEvent(
                kind=str(payload.get("kind") or "auto_error")[:40],
                source=str(payload.get("source") or "unknown")[:40],
                severity=str(payload.get("severity") or "error")[:20],
                target=str(payload.get("target") or "")[:120] or None,
                message=str(payload.get("message") or "")[:4000],
                stack=(str(payload.get("stack") or "")[:8000] or None),
                page_url=(str(payload.get("page_url") or "")[:500] or None),
                user_id=payload.get("user_id"),
                club_id=payload.get("club_id"),
                role=(str(payload.get("role") or "")[:40] or None),
                meta_json=json.dumps(payload.get("meta") or {}, ensure_ascii=False, default=str)[:8000],
                created_at=datetime.now(timezone.utc),
            )
            db.add(row)
            db.commit()
            payload["id"] = row.id
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    return payload


def _refresh_latest_md() -> None:
    """Résumé markdown des dernières lignes — pour analyse rapide par l'agent."""
    if not _JSONL.exists():
        return
    try:
        lines = _JSONL.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    recent = lines[-_MAX_MD_LINES:]
    blocks: list[str] = [
        "# ERROR / FEEDBACK — dernières entrées",
        "",
        f"_Mis à jour : {_now_iso()}_",
        f"_Fichier source : `{_JSONL.as_posix()}`_",
        "",
    ]
    for raw in reversed(recent):
        try:
            ev = json.loads(raw)
        except json.JSONDecodeError:
            continue
        blocks.append(
            f"- **{ev.get('ts', '?')}** · `{ev.get('kind')}` · `{ev.get('severity', '')}` · "
            f"target=`{ev.get('target') or '—'}` · {ev.get('message', '')[:200]}"
        )
    try:
        _LATEST_MD.write_text("\n".join(blocks) + "\n", encoding="utf-8")
    except OSError:
        pass


def read_recent(limit: int = 100, since_iso: str | None = None) -> list[dict[str, Any]]:
    """Lit le JSONL local (ordre chronologique croissant)."""
    if not _JSONL.exists():
        return []
    out: list[dict[str, Any]] = []
    try:
        for raw in _JSONL.read_text(encoding="utf-8").splitlines():
            if not raw.strip():
                continue
            try:
                ev = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if since_iso and str(ev.get("ts") or "") < since_iso:
                continue
            out.append(ev)
    except OSError:
        return []
    return out[-limit:]


def jsonl_path() -> Path:
    return _JSONL
