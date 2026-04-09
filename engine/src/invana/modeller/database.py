"""Database session factory for the app state database."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from invana.settings import settings

_ALEMBIC_INI = str(Path(__file__).resolve().parents[3] / "alembic.ini")


def run_migrations(url: str = settings.database_url) -> None:
    """Run Alembic migrations to head."""
    cfg = Config(_ALEMBIC_INI)
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")


async def create_db_engine(url: str = settings.database_url):
    """Create the async engine and run migrations to bring the schema up to date."""
    run_migrations(url)
    engine = create_async_engine(
        url,
        echo=settings.database_echo,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
    )
    return engine


def create_session_factory(engine) -> async_sessionmaker[AsyncSession]:
    """Return a session factory bound to *engine*."""
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
