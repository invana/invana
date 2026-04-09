"""Root Click group for the `invana` CLI."""

from __future__ import annotations

import click

from invana.cli.commands.loader import loader_cmd
from invana.cli.commands.migrate import migrate_cmd
from invana.cli.commands.start import start_cmd
from invana.logging import configure_logging


@click.group()
def app() -> None:
    """Invana — Graph Intelligence Platform."""
    configure_logging()


@app.command("version")
def version_cmd() -> None:
    """Print the Invana version."""
    from invana.settings import settings

    click.echo(f"Invana {settings.app_version}")


app.add_command(start_cmd)
app.add_command(migrate_cmd)
app.add_command(loader_cmd)
