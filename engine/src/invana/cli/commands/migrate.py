"""invana migrate — run Alembic migrations to head, then procrastinate's schema.

The ``tools`` queue (docs/for-developers/modules/platform/features/tool-plugins.md)
keeps its jobs in the app database, in tables procrastinate's own schema
manager owns. On Postgres, with the ``workers`` extra installed, they are
applied after Alembic — once; a database that has them is left alone.
"""

from __future__ import annotations

import asyncio
import importlib.util

import click


@click.command("migrate")
@click.option(
    "--database-url",
    default=None,
    help="App-state DB connection string (default: INVANA_DATABASE_URL).",
)
def migrate_cmd(database_url: str | None) -> None:
    """Run database migrations to head."""
    from invana.core.db import run_migrations
    from invana.core.settings import settings

    url = database_url or settings.database_url
    click.echo(f"Running migrations on: {url}")
    try:
        run_migrations(url)
    except Exception as exc:
        raise click.ClickException(f"Migration failed: {exc}") from exc
    if url.startswith("postgresql") and importlib.util.find_spec("procrastinate") is not None:
        try:
            applied = asyncio.run(_queue_schema(url))
        except Exception as exc:
            raise click.ClickException(f"The tools queue schema failed: {exc}") from exc
        click.echo("Tools queue schema applied." if applied else "Tools queue schema already present.")
    click.echo("Migrations complete.")


async def _queue_schema(url: str) -> bool:
    from invana.plugins import queue

    return await queue.apply_schema(url)
