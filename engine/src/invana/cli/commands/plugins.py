"""`invana plugins …` — the plugin registry from a shell.

docs/for-developers/modules/platform/features/tool-plugins.md. The registry is
the install's, not a Graph's, so reads name no user; switching a tool plugin is
an install Admin's act and names one with ``--user``::

    invana plugins list
    invana plugins show invana.tools.web
    invana plugins enable  invana.tools.web --user admin
    invana plugins disable invana.tools.web --user admin
    invana plugins mcp add http://localhost:9000/mcp --name files --user admin
    invana plugins mcp refresh files --user admin

``mcp add`` connects to an MCP server and freezes its tools as the plugin
``invana.mcp.<name>`` (docs/for-developers/modules/platform/features/mcp-plugins.md);
``mcp refresh`` reads them again as the next revision. Either takes effect when
each process — the API and every worker — restarts. Every command here loads
the stored MCP servers first, as a process does at start-up.

``list`` prints one tab-separated row per plugin — name, kind, version,
installed, enabled, functions. ``show`` prints JSON, the shape
``GET /api/v1/plugins/{name}`` returns. A refusal — an unknown name, a core plugin, a user who is not an
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
from invana.runtime.managers import McpManager, PluginManager
from invana.runtime.schemas import McpServerRead

_plugins = PluginManager()
_mcp = McpManager()


def _read(fn: Callable[[AsyncSession], Awaitable[Any]]) -> Any:
    """Run one read in its own session; nothing is written, so nothing is committed."""

    async def go() -> Any:
        engine = await create_db_engine()
        try:
            async with create_session_factory(engine)() as session:
                await _mcp.load(session)
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
    """Plugins: what is installed, what is enabled, switching them, and MCP servers."""


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


def _print_server(server: McpServerRead) -> None:
    click.echo(f"{server.plugin}\trevision {server.revision}\t{len(server.tools)} task types")
    for tool in server.tools:
        click.echo(f"  {tool.key}@{tool.version}\t{tool.side_effect}")
    for name in server.skipped:
        click.echo(f"  skipped {name!r}: not a name a task key can hold")
    if server.restart_required:
        click.echo(
            f"Restart the engine and every worker to load it; enable it with: invana plugins enable {server.plugin}"
        )


@plugins_cmd.group("mcp")
def mcp_cmd() -> None:
    """MCP servers: add one, or read its tools again."""


@mcp_cmd.command("add")
@click.argument("url")
@click.option("--name", required=True, help="Short name: the plugin becomes invana.mcp.<name>.")
@click.option("--user", "user_ref", required=True, help="An install Admin (username or email).")
def mcp_add(url: str, name: str, user_ref: str) -> None:
    """Connect an MCP server and freeze its tools as task types."""

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            await _mcp.load(session)
            _print_server(await _mcp.add(session, name=name, url=url, actor=actor))

    asyncio.run(go())


@mcp_cmd.command("refresh")
@click.argument("name")
@click.option("--user", "user_ref", required=True, help="An install Admin (username or email).")
def mcp_refresh(name: str, user_ref: str) -> None:
    """List an MCP server's tools again, as its next revision."""

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            await _mcp.load(session)
            _print_server(await _mcp.refresh(session, name=name, actor=actor))

    asyncio.run(go())
