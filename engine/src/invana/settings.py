"""Centralised settings loaded from environment variables and .env files."""

from __future__ import annotations

import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Fixed insecure key used only when INVANA_ENCRYPTION_KEY is not set in development.
# 32 zero bytes base64url-encoded — NEVER use in production.
_DEV_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

# Insecure dev-only fallback for INVANA_SECRET_KEY (JWT signing). NEVER use in production.
_DEV_SECRET_KEY = "invana-dev-insecure-secret-key-do-not-use-in-prod"


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

    # Auth — secret_key kept as a top-level for env-name stability (INVANA_SECRET_KEY).
    secret_key: str = ""
    # Legacy single-TTL knob retained for any older readers; superseded by AUTH_* below.
    token_expiry_minutes: int = 1440

    # Auth — all tunable constants. Override via INVANA_AUTH_* env vars.
    auth_min_password_length: int = 12
    auth_bcrypt_rounds: int = 12
    auth_jwt_algorithm: str = "HS256"
    auth_token_bytes: int = 32  # bytes of entropy for opaque refresh tokens
    auth_access_token_ttl_minutes: int = 15
    auth_refresh_token_ttl_days: int = 7
    # Username change cooldown — RFC-017. PATCH /auth/me with a new username inside the
    # window returns 409. Set to 0 to disable the cooldown (useful in tests).
    auth_username_change_cooldown_days: int = 30
    # IP-based rate limit on GET /auth/username-available — the endpoint reveals
    # whether a username is taken, so cap scraping cost. 0 disables the limit.
    auth_username_available_rate_limit_per_minute: int = 30

    # URL Studio is served from — used to build user-facing links (e.g. login).
    studio_base_url: str = "http://localhost:8300"

    # Telemetry (OpenTelemetry)
    telemetry_enabled: bool = True
    telemetry_otlp_endpoint: str = "http://localhost:4317"
    # OTLP/HTTP collector endpoint the studio's browser spans are proxied to
    # (RFC-025). Browsers can't speak OTLP gRPC, so /api/v1/telemetry/traces
    # forwards their export here verbatim, keeping the collector off the network.
    telemetry_otlp_http_endpoint: str = "http://localhost:4318/v1/traces"
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

    @model_validator(mode="after")
    def resolve_secret_key(self) -> Settings:
        if not self.secret_key:
            if self.env != "development":
                raise ValueError(
                    "INVANA_SECRET_KEY must be set in non-development environments. "
                    "Generate with: python -c 'import secrets; print(secrets.token_urlsafe(48))'"
                )
            logger.warning(
                "INVANA_SECRET_KEY is not set. Using an insecure dev-only default key. "
                "Set INVANA_SECRET_KEY in your .env file before issuing real tokens."
            )
            self.secret_key = _DEV_SECRET_KEY
        return self


settings = Settings()
