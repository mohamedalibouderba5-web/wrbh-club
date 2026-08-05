from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "WRBH Club"
    environment: str = "development"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 12  # 12 h
    algorithm: str = "HS256"
    database_url: str = "sqlite:///./wrbh.db"
    cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "https://wrbh-web.onrender.com"
    )
    upload_dir: str = "./uploads"
    default_admin_email: str = "admin@wrbh.local"
    default_admin_password: str = "admin123"
    default_locale: str = "fr"
    currency: str = "DZD"
    club_name: str = "Widad Riadi Baladiat Hammadi"
    club_name_ar: str = "الوداد الرياضي لبلدية حمادي"
    club_acronym: str = "WRBH"
    club_phone: str = "0540344884"
    # Bornes d'âge club (années révolues)
    min_athlete_age: int = 5
    max_athlete_age: int = 17
    # Pagination listes
    default_page_size: int = 50
    max_page_size: int = 200
    allow_test_cleanup: bool = False
    sentry_dsn: str = ""
    login_rate_limit: int = 10
    login_rate_window_seconds: int = 300
    # Mise à jour APK mobile (publié via env Render)
    android_app_version: str = "1.5.1"
    android_version_code: int = 7
    android_apk_url: str = (
        "https://github.com/mohamedalibouderba5-web/wrbh-club/releases/download/"
        "android-v1.5.1/wrbh-club-1.5.1.apk"
    )
    android_force_update: bool = False
    android_release_notes: str = (
        "Numérotation : N° joueur (list_number), kit, référence immuable, horodatage Alger."
    )
    android_release_notes_ar: str = (
        "الترقيم: رقم اللاعب، رقم المعدات، مرجع ثابت، توقيت الجزائر."
    )

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
