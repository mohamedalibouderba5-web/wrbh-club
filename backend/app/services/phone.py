"""Normalisation téléphones Algérie (lien parent ↔ joueur)."""
from __future__ import annotations

import re


def normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D+", "", raw.strip())
    if not digits:
        return None
    if digits.startswith("213") and len(digits) >= 12:
        digits = "0" + digits[3:]
    elif digits.startswith("00213") and len(digits) >= 14:
        digits = "0" + digits[5:]
    elif len(digits) == 9 and digits[0] in "567":
        digits = "0" + digits
    return digits


def phone_lookup_variants(raw: str) -> list[str]:
    n = normalize_phone(raw)
    if not n:
        return [raw.strip()] if raw else []
    variants = {n, raw.strip()}
    if n.startswith("0") and len(n) == 10:
        variants.add(n[1:])
        variants.add("+213" + n[1:])
        variants.add("213" + n[1:])
        variants.add(f"{n[0:4]} {n[4:6]} {n[6:8]} {n[8:10]}")
        variants.add(f"{n[0:4]}{n[4:]}")
    return [v for v in variants if v]


def default_parent_password(phone: str) -> str:
    n = normalize_phone(phone) or phone
    digits = re.sub(r"\D+", "", n)
    tail = digits[-6:] if len(digits) >= 6 else digits
    return f"wrbh{tail}" if tail else "wrbh2026"
