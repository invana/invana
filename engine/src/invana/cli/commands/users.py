"""invana users — create accounts and reset passwords from the command line.

Complements ``invana init`` (which bootstraps only the root superuser). These
commands operate directly on the app database and are meant for operators with
shell access to the engine host or container.
"""

from __future__ import annotations

import asyncio
import re

import click
from fastapi import HTTPException

from invana.auth.passwords import WeakPasswordError
from invana.auth.services import (
    admin_set_password,
    find_user_by_email_or_username,
    provision_user,
)
from invana.db import create_db_engine, create_session_factory

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


@click.group("users")
def users_cmd() -> None:
    """Manage user accounts (create, update-password)."""


@users_cmd.command("create")
@click.option(
    "--non-interactive",
    is_flag=True,
    default=False,
    help="Read all values from --username/--email/--password/--first-name flags instead of prompting.",
)
@click.option("--username", default=None, help="Username (lowercase + digits + hyphen, 2-64).")
@click.option("--email", default=None, help="Email address.")
@click.option("--password", default=None, help="Password.")
@click.option("--first-name", default=None, help="First name.")
@click.option("--last-name", default=None, help="Last name (optional).")
@click.option("--superuser", is_flag=True, default=False, help="Grant superuser (platform admin) privileges.")
def create_cmd(
    non_interactive: bool,
    username: str | None,
    email: str | None,
    password: str | None,
    first_name: str | None,
    last_name: str | None,
    superuser: bool,
) -> None:
    """Create a new user account.

    Unlike ``invana init``, this is not idempotent and is not restricted to the
    root superuser — pass ``--superuser`` to grant platform-admin privileges.
    """
    asyncio.run(
        _run_create(
            non_interactive=non_interactive,
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            superuser=superuser,
        )
    )


@users_cmd.command("update-password")
@click.option("--user", "identifier", default=None, help="Target user's email or username.")
@click.option("--password", default=None, help="New password (omit to be prompted).")
@click.option(
    "--non-interactive",
    is_flag=True,
    default=False,
    help="Read values from --user/--password flags instead of prompting.",
)
def update_password_cmd(identifier: str | None, password: str | None, non_interactive: bool) -> None:
    """Reset a user's password.

    Operator reset — no current password is required. All of the user's refresh
    tokens are revoked, so existing sessions are signed out.
    """
    asyncio.run(
        _run_update_password(
            identifier=identifier,
            password=password,
            non_interactive=non_interactive,
        )
    )


async def _run_create(
    *,
    non_interactive: bool,
    username: str | None,
    email: str | None,
    password: str | None,
    first_name: str | None,
    last_name: str | None,
    superuser: bool,
) -> None:
    engine = await create_db_engine()
    session_factory = create_session_factory(engine)
    try:
        async with session_factory() as session:
            if non_interactive:
                if not (username and email and password and first_name):
                    raise click.UsageError(
                        "--non-interactive requires --username, --email, --password, and --first-name."
                    )
                _username = _validate_username_cli(username)
                _email = email.strip().lower()
                _password = password
                _first_name = first_name.strip()
                _last_name = last_name.strip() if last_name else None
            else:
                _username = _validate_username_cli(click.prompt("Username"))
                _first_name = click.prompt("First name").strip()
                _last_name_raw = click.prompt("Last name (optional)", default="", show_default=False)
                _last_name = _last_name_raw.strip() or None
                _email = click.prompt("Email").strip().lower()
                _password = click.prompt("Password", hide_input=True, confirmation_prompt="Confirm")

            try:
                user = await provision_user(
                    session,
                    email=_email,
                    password=_password,
                    username=_username,
                    first_name=_first_name,
                    last_name=_last_name,
                    is_superuser=superuser,
                )
            except WeakPasswordError as e:
                raise click.ClickException(str(e)) from e
            except HTTPException as e:
                raise click.ClickException(str(e.detail)) from e
            await session.commit()

        kind = "superuser" if superuser else "user"
        click.echo(f"✓ Created {kind} ({user.email}, @{user.username}).")
    finally:
        await engine.dispose()


async def _run_update_password(
    *,
    identifier: str | None,
    password: str | None,
    non_interactive: bool,
) -> None:
    engine = await create_db_engine()
    session_factory = create_session_factory(engine)
    try:
        async with session_factory() as session:
            if non_interactive:
                if not (identifier and password):
                    raise click.UsageError("--non-interactive requires --user and --password.")
                _identifier = identifier
                _password = password
            else:
                _identifier = identifier or click.prompt("User (email or username)")
                _password = password or click.prompt(
                    "New password",
                    hide_input=True,
                    confirmation_prompt="Confirm",
                )

            user = await find_user_by_email_or_username(session, identifier=_identifier)
            if user is None:
                raise click.ClickException(f"No user found matching '{_identifier}'.")

            try:
                await admin_set_password(session, user=user, new_password=_password)
            except WeakPasswordError as e:
                raise click.ClickException(str(e)) from e
            await session.commit()

        click.echo(f"✓ Password updated for {user.email} (@{user.username}). Existing sessions revoked.")
    finally:
        await engine.dispose()
