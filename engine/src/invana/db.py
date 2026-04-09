"""Shared database engine and session factories.

Single place for creating async and sync SQLAlchemy engines so that
the modeller, server, admin panel, and tests all share the same
configuration.
"""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from invana.settings import settings

_ALEMBIC_INI = str(Path(__file__).resolve().parents[2] / "alembic.ini")


def run_migrations(url: str = settings.database_url) -> None:
    """Run Alembic migrations to head."""
    cfg = Config(_ALEMBIC_INI)
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")


async def create_db_engine(url: str = settings.database_url):
    """Create an async engine and run migrations to bring the schema up to date."""
    run_migrations(url)
    return create_async_engine(
        url,
        echo=settings.database_echo,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
    )


def create_sync_engine(url: str | None = None):
    """Create a synchronous engine (used by starlette-admin).

    Derives the sync URL from the async URL by stripping ``+asyncpg``.
    """
    async_url = url or settings.database_url
    sync_url = async_url.replace("+asyncpg", "")
    return create_engine(
        sync_url,
        echo=settings.database_echo,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
    )


def create_session_factory(engine) -> async_sessionmaker[AsyncSession]:
    """Return an async session factory bound to *engine*."""
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
