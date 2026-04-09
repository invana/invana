"""Alembic async environment for invana modeller migrations."""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Import all models so metadata is fully populated for autogenerate.
from invana.modeller.models import Base  # noqa: F401
from invana.settings import settings

config = context.config

# Override alembic.ini URL with the value from settings / .env.
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL statements without a live database connection."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    When called inside an already-running event loop (e.g. FastAPI lifespan)
    we fall back to a *synchronous* psycopg2 connection so we don't need to
    nest ``asyncio.run()``.
    """
    try:
        asyncio.get_running_loop()
        _is_async = True
    except RuntimeError:
        _is_async = False

    if _is_async:
        # We're inside an event loop — use a sync connection instead.
        from sqlalchemy import create_engine

        sync_url = config.get_main_option("sqlalchemy.url", "").replace("+asyncpg", "")
        connectable = create_engine(sync_url, poolclass=pool.NullPool)
        with connectable.connect() as connection:
            do_run_migrations(connection)
        connectable.dispose()
    else:
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
