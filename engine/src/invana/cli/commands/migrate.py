"""invana migrate — run Alembic migrations to head."""

from __future__ import annotations

import click


@click.command("migrate")
@click.option(
    "--database-url",
    default=None,
    help="App-state DB connection string (default: INVANA_DATABASE_URL).",
)
def migrate_cmd(database_url: str | None) -> None:
    """Run database migrations to head."""
    from invana.db import run_migrations
    from invana.settings import settings

    url = database_url or settings.database_url
    click.echo(f"Running migrations on: {url}")
    try:
        run_migrations(url)
    except Exception as exc:
        raise click.ClickException(f"Migration failed: {exc}") from exc
    click.echo("Migrations complete.")
