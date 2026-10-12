"""`invana plugins …` and `invana tasks show` — the plugin registry from a shell.

docs/for-developers/modules/platform/features/tool-plugins.md. The registry is
the install's, not a Graph's, so reads name no user; switching a tool plugin is
an install Admin's act and names one with ``--user``::

    invana plugins list
    invana plugins show invana.tools.web
    invana plugins enable  invana.tools.web --user admin
    invana plugins disable invana.tools.web --user admin
    invana tasks show execute_graph_query@1.0.0

``list`` prints one tab-separated row per plugin — name, kind, version,
installed, enabled, task types. ``show`` and ``tasks show`` print JSON, the
shape ``GET /api/v1/plugins/{name}`` and ``GET /api/v1/task-types/{ref}``
return. A refusal — an unknown name, a core plugin, a user who is not an
install Admin — prints the manager's sentence and exits 1.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import Any

import click
from sqlalchemy.ext.asyncio import AsyncSession

from invana.cli.context import as_user, refusal
from invana.core.db import create_db_engine, create_session_factory
from invana.core.errors import InvanaError
from invana.runtime.managers import PluginManager

_plugins = PluginManager()


def _read(fn: Callable[[AsyncSession], Awaitable[Any]]) -> Any:
    """Run one read in its own session; nothing is written, so nothing is committed."""

    async def go() -> Any:
        engine = await create_db_engine()
        try:
            async with create_session_factory(engine)() as session:
                return await fn(session)
        except InvanaError as exc:
            raise refusal(exc) from exc
        finally:
            await engine.dispose()

    return asyncio.run(go())


def _switch(name: str, user_ref: str, *, enabled: bool) -> None:
    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            summary = await _plugins.switch(session, name=name, enabled=enabled, actor=actor)
            click.echo(f"{summary.name}\t{'enabled' if summary.enabled else 'disabled'}")

    asyncio.run(go())


def _yes(flag: bool) -> str:
    return "yes" if flag else "no"


@click.group("plugins")
def plugins_cmd() -> None:
    """Plugins: what is installed, what is enabled, and switching tool plugins."""


@plugins_cmd.command("list")
def list_() -> None:
    """Every plugin — core, simulator, tool — and whether it may run."""
    click.echo("name\tkind\tversion\tinstalled\tenabled\ttask types")
    for p in _read(_plugins.list):
        click.echo(f"{p.name}\t{p.kind}\t{p.version}\t{_yes(p.installed)}\t{_yes(p.enabled)}\t{p.task_types}")


@plugins_cmd.command("show")
@click.argument("name")
def show(name: str) -> None:
    """One plugin with its task types, flows and skills, as JSON."""
    detail = _read(lambda session: _plugins.show(session, name))
    click.echo(json.dumps(detail.model_dump(mode="json"), indent=2))


@plugins_cmd.command("enable")
@click.argument("name")
@click.option("--user", "user_ref", required=True, help="An install Admin (username or email).")
def enable(name: str, user_ref: str) -> None:
    """Enable a tool plugin for every Graph on this install."""
    _switch(name, user_ref, enabled=True)


@plugins_cmd.command("disable")
@click.argument("name")
@click.option("--user", "user_ref", required=True, help="An install Admin (username or email).")
def disable(name: str, user_ref: str) -> None:
    """Disable a tool plugin; a step naming one of its task types is refused from now."""
    _switch(name, user_ref, enabled=False)


@click.group("tasks")
def tasks_cmd() -> None:
    """Task types: what one declares, and how often it ran."""


@tasks_cmd.command("show")
@click.argument("ref")
def show_task(ref: str) -> None:
    """One task type by `key` or `key@version`, as JSON."""
    task = _read(lambda session: _plugins.task_type(session, ref))
    click.echo(json.dumps(task.model_dump(mode="json"), indent=2))
