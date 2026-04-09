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

    # Graph connector (used by CLI and future API routes)
    graph_uri: str = ""
    graph_username: str = ""
    graph_password: str = ""
    graph_connector: str = ""  # dotted path, e.g. "invana_neo4j.Neo4jConnector"


settings = Settings()
