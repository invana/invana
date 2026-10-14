"""`invana members …` — a Graph's members and their Graph roles, from a terminal.

docs/for-developers/modules/identity-and-access/features/membership.md ·
features/roles.md. Every command names the Graph; ``--user`` is who acts and
defaults to the Graph's owner:

    invana members list       --graph ada/arabidopsis [--json]
    invana members add        bo@lab.org --role modeller --role builder --graph ada/arabidopsis
    invana members set-roles  bo --role viewer --graph ada/arabidopsis
    invana members remove     bo --graph ada/arabidopsis

The roles are ``viewer · contributor · builder · modeller · owner``; no
``--role`` is ``viewer``. The command refuses what the API refuses — an unknown
role, a person with no account, removing or demoting the last owner — and exits 1.
"""

from __future__ import annotations

import asyncio
import json

import click

from invana.apps.graphs.managers import GraphMemberManager
from invana.cli.context import graph_options, on_graph

_members = GraphMemberManager()


def _role_option(fn):
    return click.option(
        "--role",
        "roles",
        multiple=True,
        help="A Graph role: viewer · contributor · builder · modeller · owner. Repeat for several.",
    )(fn)


@click.group("members")
def members_cmd() -> None:
    """A Graph's members and their roles — list, add, set-roles, remove."""


@members_cmd.command("list")
@graph_options
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of a table.")
def list_(graph_ref: str, user_ref: str | None, as_json: bool) -> None:
    """Every member and the roles they hold."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            members = await _members.members(session, graph=graph)
        if as_json:
            click.echo(json.dumps([m.model_dump(mode="json") for m in members], indent=2))
            return
        for m in members:
            click.echo(f"{m.username}\t{' · '.join(m.roles)}")

    asyncio.run(go())


@members_cmd.command("add")
@click.argument("person")
@_role_option
@graph_options
def add(person: str, roles: tuple[str, ...], graph_ref: str, user_ref: str | None) -> None:
    """Add PERSON (an email or a username) with the roles given."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            row = await _members.add(session, graph=graph, identifier=person, roles=list(roles), actor_id=actor.id)
            line = f"added\t{row.user.username}\t{' · '.join(row.roles)}"
        click.echo(line)

    asyncio.run(go())


@members_cmd.command("set-roles")
@click.argument("username")
@_role_option
@graph_options
def set_roles(username: str, roles: tuple[str, ...], graph_ref: str, user_ref: str | None) -> None:
    """Replace USERNAME's roles with the ones given."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            row = await _members.set_roles(
                session, graph=graph, username=username, roles=list(roles), actor_id=actor.id
            )
            line = f"{row.user.username}\t{' · '.join(row.roles)}"
        click.echo(line)

    asyncio.run(go())


@members_cmd.command("remove")
@click.argument("username")
@graph_options
def remove(username: str, graph_ref: str, user_ref: str | None) -> None:
    """Remove USERNAME from the Graph. Their work stays."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            await _members.remove(session, graph=graph, username=username, actor_id=actor.id)
        click.echo(f"removed\t{username}")

    asyncio.run(go())
