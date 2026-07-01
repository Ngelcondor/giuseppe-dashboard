"""Configuration settings for the application."""
from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from typing import Optional, Union

# Placeholder shipped in .env.example — must never survive in production.
_INSECURE_SECRET_KEY = "your-secret-key-change-in-production"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App Configuration
    APP_NAME: str = "Giuseppe Dashboard API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # "production" on the prod host
    DISABLE_DOCS: bool = False  # docs are always off in production regardless

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    # Database Configuration
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/giuseppe_dashboard"
    DATABASE_ECHO: bool = False

    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_EXPIRY: int = 3600

    # Security Configuration
    SECRET_KEY: str = _INSECURE_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_EXPIRY_HOURS: int = 24

    # API Keys
    WEATHER_API_KEY: str = ""
    OPENWEATHERMAP_API_URL: str = "https://api.openweathermap.org/data/2.5"

    # CORS Configuration
    CORS_ORIGINS: str = "*"
    CORS_CREDENTIALS: bool = False  # True only when CORS_ORIGINS is a specific domain list (not "*")
    CORS_METHODS: str = "*"
    CORS_HEADERS: str = "*"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def cors_methods_list(self) -> list[str]:
        if self.CORS_METHODS == "*":
            return ["*"]
        return [m.strip() for m in self.CORS_METHODS.split(",")]

    @property
    def cors_headers_list(self) -> list[str]:
        if self.CORS_HEADERS == "*":
            return ["*"]
        return [h.strip() for h in self.CORS_HEADERS.split(",")]

    # Celery Configuration
    # Derived from REDIS_URL by default — override via env vars if needed.
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""

    @field_validator("CELERY_BROKER_URL", mode="before")
    @classmethod
    def _default_celery_broker(cls, v: str, info) -> str:
        if v:
            return v
        redis_url = info.data.get("REDIS_URL", "redis://localhost:6379/0")
        # Use DB 1 for broker (strip trailing /N and append /1)
        base = redis_url.rsplit("/", 1)[0]
        return f"{base}/1"

    @field_validator("CELERY_RESULT_BACKEND", mode="before")
    @classmethod
    def _default_celery_backend(cls, v: str, info) -> str:
        if v:
            return v
        redis_url = info.data.get("REDIS_URL", "redis://localhost:6379/0")
        # Use DB 2 for result backend
        base = redis_url.rsplit("/", 1)[0]
        return f"{base}/2"

    # Apple Health Configuration
    APPLE_HEALTH_IMPORT_ENABLED: bool = True
    APPLE_HEALTH_WEBHOOK_SECRET: str = ""  # Set in .env to enable iOS Shortcuts sync

    # CalDAV / Apple Calendar Configuration
    CALDAV_SYNC_ENABLED: bool = True
    CALDAV_DEFAULT_SYNC_INTERVAL: int = 15  # minutes
    CALDAV_SYNC_DAYS_BACK: int = 7
    CALDAV_SYNC_DAYS_FORWARD: int = 90

    # AWS S3 Configuration (for file uploads)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_S3_BUCKET: str = "giuseppe-dashboard"
    AWS_S3_REGION: str = "us-east-1"

    # Single-user credentials (used to auto-seed on first startup).
    # No personal defaults in code: both come from the environment; the seed
    # is skipped (with a warning) when either is missing.
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""  # plain password, read at startup to seed DB
    ALLOW_ADMIN_INIT: bool = False  # gate for POST /auth/init (see README §Security)

    # Open Banking — Provider-agnostic (configure one of the two)
    # Option 1: Enable Banking (recommended — free for personal use)
    # Register at https://enablebanking.com/  ·  App "Giuseppe Dashboard" (SANDBOX)
    # App ID is an identifier (not secret); the private RSA key goes in
    # ENABLE_BANKING_APP_SECRET via env only (never commit it). Redirect URL must
    # match exactly a value registered in the EB app (EB rejects query strings).
    ENABLE_BANKING_APP_ID: str = ""  # from env only — no personal defaults in code
    ENABLE_BANKING_APP_SECRET: str = ""
    ENABLE_BANKING_REDIRECT_URL: str = "http://localhost:3000/dashboard/budget"

    # Option 2: GoCardless Bank Account Data (legacy — not accepting new signups)
    GOCARDLESS_SECRET_ID: str = ""
    GOCARDLESS_SECRET_KEY: str = ""
    GOCARDLESS_BASE_URL: str = "https://bankaccountdata.gocardless.com/api/v2"
    GOCARDLESS_REDIRECT_URL: str = "http://localhost:3000/dashboard/budget?bank=callback"
    GOCARDLESS_INSTITUTION_ID: str = "REVOLUT_REVOGB21"

    # Feature Flags
    ENABLE_NOTIFICATIONS: bool = True
    ENABLE_FEED: bool = True

    @model_validator(mode="after")
    def _fail_fast_in_production(self) -> "Settings":
        """Refuse to boot production with an insecure or missing SECRET_KEY."""
        if self.is_production and (not self.SECRET_KEY or self.SECRET_KEY == _INSECURE_SECRET_KEY):
            raise RuntimeError(
                "SECRET_KEY non impostata (o lasciata al placeholder) con "
                "ENVIRONMENT=production. Genera una chiave forte, es.: "
                "python -c 'import secrets; print(secrets.token_urlsafe(64))'"
            )
        return self

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = True


settings = Settings()
