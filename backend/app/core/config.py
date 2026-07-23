from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "WRBH Club"
    environment: str = "development"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 24 * 7
    algorithm: str = "HS256"
    database_url: str = "sqlite:///./wrbh.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    upload_dir: str = "./uploads"
    default_admin_email: str = "admin@wrbh.local"
    default_admin_password: str = "admin123"
    default_locale: str = "fr"
    currency: str = "DZD"
    club_name: str = "Widad Riadi Baladiat Hammadi"
    club_name_ar: str = "الوداد الرياضي لبلدية حمادي"
    club_acronym: str = "WRBH"
    club_phone: str = "0540344884"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
