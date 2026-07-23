ALLOWED_BLOOD = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}


def validate_blood_type(raw: str | None) -> str | None:
    if raw is None or str(raw).strip() == "":
        return None
    value = str(raw).strip().upper().replace(" ", "")
    if value not in ALLOWED_BLOOD:
        raise ValueError(f"Groupe sanguin invalide ({raw}). Utilisez : {', '.join(sorted(ALLOWED_BLOOD))}")
    return value
