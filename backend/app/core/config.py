from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Nadi Connect"
    environment: str = "development"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 12  # 12 h
    algorithm: str = "HS256"
    database_url: str = "sqlite:///./wrbh.db"
    cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://46.224.38.201:8080"
    )
    upload_dir: str = "./uploads"
    default_admin_email: str = "admin@nadi-connect.local"
    default_admin_password: str = "admin123"
    platform_admin_email: str = "platform@nadi-connect.local"
    platform_admin_password: str = "ChangeMePlatform2026!"
    default_locale: str = "fr"
    currency: str = "DZD"
    # Fallbacks tenant — PAS l'identité produit (produit = app_name = Nadi Connect)
    club_name: str = "Club"
    club_name_ar: str = "نادي"
    club_acronym: str = "CLUB"
    club_phone: str = ""
    # Bornes d'âge club (années révolues)
    min_athlete_age: int = 5
    max_athlete_age: int = 17
    # Pagination listes
    default_page_size: int = 50
    max_page_size: int = 200
    allow_test_cleanup: bool = False
    sentry_dsn: str = ""
    # B3 : plafond par compte (strict) + plafond IP large (NAT club / stand salon)
    login_rate_limit: int = 10
    login_rate_limit_ip: int = 100
    login_rate_window_seconds: int = 300
    onboard_rate_limit: int = 5
    onboard_rate_limit_ip: int = 30
    app_version: str = "1.18.0"
    git_sha: str = ""  # injecté au déploiement (env GIT_SHA)
    # Mise à jour APK mobile (publié via env Render)
    android_app_version: str = "1.9.0"
    android_version_code: int = 12
    android_apk_url: str = "http://46.224.38.201:8080/wrbh-club-1.9.0.apk"
    android_force_update: bool = False
    android_release_notes: str = (
        "Nadi Connect 1.9: licence/certificat médical, messages 403, pastilles expiration."
    )
    android_release_notes_ar: str = (
        "نادي كونكت 1.9: الرخصة والشهادة الطبية، رسائل 403، تنبيهات التجديد."
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
