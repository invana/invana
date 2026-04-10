"""Centralised settings loaded from environment variables and .env files."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


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


settings = Settings()
