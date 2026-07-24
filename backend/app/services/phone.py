"""Normalisation téléphones Algérie (lien parent ↔ joueur)."""
from __future__ import annotations

import re
import secrets
import string


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


def validate_dz_mobile(raw: str | None, *, required: bool = False) -> str:
    """Exige un mobile DZ 05/06/07 + 8 chiffres (10 au total)."""
    if not raw or not str(raw).strip():
        if required:
            raise ValueError("Numéro de téléphone parent obligatoire.")
        return ""
    n = normalize_phone(raw)
    if not n or len(n) != 10 or not n.startswith(("05", "06", "07")):
        raise ValueError("Téléphone DZ invalide (ex. 05XXXXXXXX / 06XXXXXXXX / 07XXXXXXXX).")
    return n


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


def generate_parent_password(length: int = 12) -> str:
    """Mot de passe aléatoire fort (non dérivable du téléphone)."""
    alphabet = string.ascii_letters + string.digits
    # Évite caractères ambigus
    alphabet = alphabet.replace("O", "").replace("0", "").replace("l", "").replace("I", "")
    return "".join(secrets.choice(alphabet) for _ in range(length))


def default_parent_password(phone: str) -> str:
    """Deprecated — conserve le nom pour compat imports ; génère un MDP aléatoire."""
    _ = phone
    return generate_parent_password()
