"""Root Click group for the `invana` CLI."""

from __future__ import annotations

import click

from invana.cli.commands.govern import govern_cmd
from invana.cli.commands.init import init_cmd
from invana.cli.commands.loader import loader_cmd
from invana.cli.commands.migrate import migrate_cmd
from invana.cli.commands.models import models_cmd
from invana.cli.commands.records import records_cmd
from invana.cli.commands.start import start_cmd
from invana.cli.commands.stitches import stitches_cmd
from invana.cli.commands.users import users_cmd
from invana.core.logging import configure_logging


@click.group()
def app() -> None:
    """Invana — Graph Intelligence Platform."""
    configure_logging()


@app.command("version")
def version_cmd() -> None:
    """Print the Invana version."""
    from invana.core.settings import settings

    click.echo(f"Invana {settings.app_version}")


app.add_command(start_cmd)
app.add_command(migrate_cmd)
app.add_command(loader_cmd)
app.add_command(init_cmd)
app.add_command(users_cmd)
app.add_command(models_cmd)
app.add_command(records_cmd)
app.add_command(stitches_cmd)
app.add_command(govern_cmd)
