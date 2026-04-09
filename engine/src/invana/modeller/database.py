"""Database session factory for the app state database."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from invana.modeller.models import Base


async def create_db_engine(url: str = "sqlite+aiosqlite:///invana.db"):
    """Create the async engine and ensure tables exist."""
    engine = create_async_engine(url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine


def create_session_factory(engine) -> async_sessionmaker[AsyncSession]:
    """Return a session factory bound to *engine*."""
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
