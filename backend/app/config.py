from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = Field(default="development", alias="ENVIRONMENT")
    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")
    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_access_ttl_minutes: int = Field(default=15, alias="JWT_ACCESS_TTL_MINUTES")
    jwt_refresh_ttl_days: int = Field(default=7, alias="JWT_REFRESH_TTL_DAYS")
    frontend_origin: str = Field(default="http://localhost:3000", alias="FRONTEND_ORIGIN")

    llm_api_key: str | None = Field(default=None, alias="LLM_API_KEY")
    llm_api_base_url: str | None = Field(default=None, alias="LLM_API_BASE_URL")
    llm_model: str | None = Field(default=None, alias="LLM_MODEL")
    email_api_key: str | None = Field(default=None, alias="EMAIL_API_KEY")
    email_from_address: str | None = Field(default=None, alias="EMAIL_FROM_ADDRESS")
    object_storage_bucket: str | None = Field(default=None, alias="OBJECT_STORAGE_BUCKET")
    object_storage_access_key: str | None = Field(default=None, alias="OBJECT_STORAGE_ACCESS_KEY")
    object_storage_secret_key: str | None = Field(default=None, alias="OBJECT_STORAGE_SECRET_KEY")
    dedup_radius_meters: int = Field(default=150, alias="DEDUP_RADIUS_METERS")
    dedup_time_window_minutes: int = Field(default=30, alias="DEDUP_TIME_WINDOW_MINUTES")
    delayed_response_threshold_minutes: int = Field(
        default=15, alias="DELAYED_RESPONSE_THRESHOLD_MINUTES"
    )
    worker_health_port: int = Field(default=8081, alias="WORKER_HEALTH_PORT")
    bootstrap_admin_email: str | None = Field(default=None, alias="BOOTSTRAP_ADMIN_EMAIL")
    bootstrap_admin_password: str | None = Field(default=None, alias="BOOTSTRAP_ADMIN_PASSWORD")

    classifier_poll_seconds: float = Field(default=2.0, alias="CLASSIFIER_POLL_SECONDS")
    classifier_max_attempts: int = Field(default=5, alias="CLASSIFIER_MAX_ATTEMPTS")


@lru_cache
def get_settings() -> Settings:
    return Settings()
