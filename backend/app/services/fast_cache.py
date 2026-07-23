"""Cache mémoire TTL ultra-léger (process Render)."""
from __future__ import annotations

from threading import Lock
from time import monotonic
from typing import Any

_lock = Lock()
_store: dict[str, tuple[float, Any]] = {}


def cache_get(key: str) -> Any | None:
    with _lock:
        item = _store.get(key)
        if not item:
            return None
        expires, value = item
        if expires < monotonic():
            _store.pop(key, None)
            return None
        return value


def cache_set(key: str, value: Any, ttl_sec: float) -> None:
    with _lock:
        _store[key] = (monotonic() + ttl_sec, value)


def cache_delete_prefix(prefix: str) -> None:
    with _lock:
        dead = [k for k in _store if k.startswith(prefix)]
        for k in dead:
            _store.pop(k, None)


def cache_clear() -> None:
    with _lock:
        _store.clear()
