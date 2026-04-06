"""Configuration settings for the application."""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, Union


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App Configuration
    APP_NAME: str = "Giuseppe Dashboard API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENV: str = "development"

    # Database Configuration
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/giuseppe_dashboard"
    DATABASE_ECHO: bool = False

    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_EXPIRY: int = 3600

    # Security Configuration
    SECRET_KEY: str = "your-secret-key-change-in-production"
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
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

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

    # Single-user credentials (used to auto-seed on first startup)
    ADMIN_EMAIL: str = "giuseppe.diansr@hotmail.it"
    ADMIN_PASSWORD: str = ""  # plain password, read at startup to seed DB

    # Feature Flags
    ENABLE_NOTIFICATIONS: bool = True
    ENABLE_FEED: bool = True

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = True


settings = Settings()
