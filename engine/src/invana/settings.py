"""Centralised settings loaded from environment variables and .env files."""

from __future__ import annotations

import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Fixed insecure key used only when INVANA_ENCRYPTION_KEY is not set in development.
# 32 zero bytes base64url-encoded — NEVER use in production.
_DEV_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="INVANA_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "Invana"
    app_version: str = "0.0.0"

    # Core
    env: str = "development"
    debug: bool = False
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "DEBUG"

    # App-state database (PostgreSQL / SQLite)
    database_url: str = "postgresql+asyncpg://invana:invana@localhost:35432/invana"
    database_pool_size: int = 10
    database_max_overflow: int = 20
    database_echo: bool = False

    # Auth
    secret_key: str = ""
    token_expiry_minutes: int = 1440

    # Telemetry (OpenTelemetry)
    telemetry_enabled: bool = True
    telemetry_otlp_endpoint: str = "http://localhost:4317"
    telemetry_service_name: str = "invana-engine"
    telemetry_environment: str = "development"

    # Graphs — runtime connection pool
    encryption_key: str = ""  # INVANA_ENCRYPTION_KEY — required in production; 32-byte URL-safe base64 Fernet key
    graph_health_interval_s: int = 30  # INVANA_GRAPH_HEALTH_INTERVAL_S
    graph_retry_max_interval_s: int = 60  # INVANA_GRAPH_RETRY_MAX_INTERVAL_S

    # CORS — comma-separated allowed origins; use * for development only
    cors_origins: list[str] = ["http://localhost:8300", "http://127.0.0.1:8300"]

    @model_validator(mode="after")
    def resolve_encryption_key(self) -> Settings:
        if not self.encryption_key:
            if self.env != "development":
                raise ValueError(
                    "INVANA_ENCRYPTION_KEY must be set in non-development environments. "
                    "Generate with: python -c 'from cryptography.fernet import Fernet; "
                    "print(Fernet.generate_key().decode())'"
                )
            logger.warning(
                "INVANA_ENCRYPTION_KEY is not set. Using an insecure dev-only default key. "
                "Set INVANA_ENCRYPTION_KEY in your .env file before storing real credentials."
            )
            self.encryption_key = _DEV_ENCRYPTION_KEY
        return self


settings = Settings()
