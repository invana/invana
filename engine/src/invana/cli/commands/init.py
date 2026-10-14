"""invana init — bootstrap the root superuser.

Per docs/for-developers/modules/identity-and-access/spec.md, no personal Graph is auto-created. The root user lands on
an
empty ``/graphs`` list in Studio and creates their first Graph manually.

Idempotent: refuses to recreate if any superuser already exists. The new
superuser logs in via the Studio UI; this command does NOT issue tokens.
"""

from __future__ import annotations

import asyncio
import re

import click
from fastapi import HTTPException

from invana.core.auth.managers import AuthManager
from invana.core.auth.passwords import WeakPasswordError
from invana.core.db import create_db_engine, create_session_factory
from invana.core.settings import settings

_USERNAME_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")


def _validate_username_cli(raw: str) -> str:
    """Mirror service-layer validation for early CLI feedback."""
    value = raw.strip().lower()
    if not (2 <= len(value) <= 64):
        raise click.UsageError("Username must be 2-64 characters.")
    if not _USERNAME_PATTERN.match(value):
        raise click.UsageError(
            "Username may contain lowercase letters, digits, and hyphens, "
            "and must start and end with a letter or digit."
        )
    if "--" in value:
        raise click.UsageError("Username may not contain consecutive hyphens.")
    return value


@click.command("init")
@click.option(
    "--non-interactive",
    is_flag=True,
    default=False,
    help="Read the values from the flags instead of prompting; --username, --password and --first-name are required.",
)
@click.option("--username", default=None, help="Root username (lowercase + digits + hyphen, 2-64).")
@click.option("--email", default=None, help="Root email (optional).")
@click.option("--password", default=None, help="Root password.")
@click.option("--first-name", default=None, help="Root first name.")
@click.option("--last-name", default=None, help="Root last name.")
def init_cmd(
    non_interactive: bool,
    username: str | None,
    email: str | None,
    password: str | None,
    first_name: str | None,
    last_name: str | None,
) -> None:
    """Create the root superuser.

    Nothing is defaulted: the person running it chooses the username and the
    password, at the prompts or through the flags. Idempotent — if any
    superuser already exists, exits without changes. No personal Graph is
    created; the user creates their first Graph after login.
    """
    if non_interactive:
        missing = [
            flag
            for flag, value in (("--username", username), ("--password", password), ("--first-name", first_name))
            if not value
        ]
        if missing:
            raise click.UsageError(f"--non-interactive needs {', '.join(missing)}.")
    asyncio.run(
        _run_init(
            non_interactive=non_interactive,
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
    )


async def _run_init(
    *,
    non_interactive: bool,
    username: str | None,
    email: str | None,
    password: str | None,
    first_name: str | None,
    last_name: str | None,
) -> None:
    engine = await create_db_engine()
    session_factory = create_session_factory(engine)
    try:
        async with session_factory() as session:
            if await AuthManager().any_superuser_exists(session):
                click.echo(
                    "A superuser already exists. Provision more users via the "
                    "superuser-only POST /api/v1/auth/register."
                )
                return

            if non_interactive:
                # init_cmd has already refused a missing required flag.
                _username = _validate_username_cli(username or "")
                _email = (email.strip().lower() or None) if email else None
                _password = password or ""
                _first_name = (first_name or "").strip()
                _last_name = last_name.strip() if last_name else None
            else:
                _username = _validate_username_cli(click.prompt("Username"))
                _first_name = click.prompt("First name").strip()
                _last_name_raw = click.prompt("Last name (optional)", default="", show_default=False)
                _last_name = _last_name_raw.strip() or None
                _email_raw = click.prompt("Email (optional)", default="", show_default=False).strip()
                _email = _email_raw.lower() or None
                _password = click.prompt(
                    "Password",
                    hide_input=True,
                    confirmation_prompt="Confirm",
                )

            try:
                user = await AuthManager().bootstrap_root(
                    session,
                    email=_email,
                    password=_password,
                    username=_username,
                    first_name=_first_name,
                    last_name=_last_name,
                )
            except WeakPasswordError as e:
                raise click.ClickException(str(e)) from e
            except HTTPException as e:
                raise click.ClickException(str(e.detail)) from e
            await session.commit()

        click.echo(f"✓ Created root superuser ({user.email or 'no email'}, @{user.username}).")
        click.echo(f"  Log in at: {settings.studio_base_url}/login")
        click.echo("  You can create your first Graph after signing in.")
    finally:
        await engine.dispose()
