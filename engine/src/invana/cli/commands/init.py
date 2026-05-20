"""invana init — bootstrap the root superuser and their personal workspace.

Idempotent: refuses to recreate if any superuser already exists. The new
admin logs in via the Studio UI; this command does NOT issue tokens.
"""

from __future__ import annotations

import asyncio
import re

import click

from invana.auth.passwords import WeakPasswordError
from invana.auth.services import any_superuser_exists, bootstrap_root
from invana.db import create_db_engine, create_session_factory
from invana.settings import settings

_SLUG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "workspace"


@click.command("init")
@click.option(
    "--non-interactive",
    is_flag=True,
    default=False,
    help="Read all values from --email/--password/--first-name flags instead of prompting.",
)
@click.option("--email", default=None, help="Admin email (non-interactive only).")
@click.option("--password", default=None, help="Admin password (non-interactive only).")
@click.option("--first-name", default=None, help="Admin first name (non-interactive only).")
@click.option("--last-name", default=None, help="Admin last name (non-interactive only).")
@click.option(
    "--workspace-name",
    default=None,
    help="Workspace display name. Defaults to '<first_name>'s workspace'.",
)
@click.option(
    "--workspace-slug",
    default=None,
    help="Workspace URL slug (lowercase, alphanumeric + hyphen). Defaults to slugified first name.",
)
def init_cmd(
    non_interactive: bool,
    email: str | None,
    password: str | None,
    first_name: str | None,
    last_name: str | None,
    workspace_name: str | None,
    workspace_slug: str | None,
) -> None:
    """Create the root superuser and a default workspace.

    Idempotent — if any superuser already exists, exits without changes.
    """
    asyncio.run(
        _run_init(
            non_interactive=non_interactive,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            workspace_name=workspace_name,
            workspace_slug=workspace_slug,
        )
    )


async def _run_init(
    *,
    non_interactive: bool,
    email: str | None,
    password: str | None,
    first_name: str | None,
    last_name: str | None,
    workspace_name: str | None,
    workspace_slug: str | None,
) -> None:
    engine = await create_db_engine()
    session_factory = create_session_factory(engine)
    try:
        async with session_factory() as session:
            if await any_superuser_exists(session):
                click.echo("An admin user already exists. Use the Studio invitations flow to add more users.")
                return

            if non_interactive:
                if not (email and password and first_name):
                    raise click.ClickException("--non-interactive requires --email, --password, and --first-name.")
                _email = email.strip()
                _password = password
                _first_name = first_name.strip()
                _last_name = last_name.strip() if last_name else None
            else:
                _first_name = click.prompt("First name").strip()
                _last_name_raw = click.prompt("Last name (optional)", default="", show_default=False)
                _last_name = _last_name_raw.strip() or None
                _email = click.prompt("Email").strip().lower()
                _password = click.prompt(
                    "Password",
                    hide_input=True,
                    confirmation_prompt="Confirm",
                )

            _workspace_name = workspace_name.strip() if workspace_name else f"{_first_name}'s workspace"
            _workspace_slug = workspace_slug.strip().lower() if workspace_slug else _slugify(_first_name)
            if not _SLUG_PATTERN.match(_workspace_slug):
                raise click.ClickException(
                    f"Workspace slug '{_workspace_slug}' is invalid. "
                    "Use lowercase letters, digits, and hyphens (starting with a letter or digit)."
                )

            try:
                user, workspace = await bootstrap_root(
                    session,
                    email=_email,
                    password=_password,
                    first_name=_first_name,
                    last_name=_last_name,
                    workspace_name=_workspace_name,
                    workspace_slug=_workspace_slug,
                )
            except WeakPasswordError as e:
                raise click.ClickException(str(e)) from e
            await session.commit()

        click.echo(f"✓ Created root admin user ({user.email}).")
        click.echo(f"✓ Created workspace '{workspace.name}' (slug: {workspace.slug}).")
        click.echo(f"  Log in at: {settings.studio_base_url}/login")
    finally:
        await engine.dispose()
