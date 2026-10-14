"""`invana notifications …` — the inbox, the rules that fill it, and the channels they send to.

docs/for-developers/modules/operate/features/notifications.md. ``--user`` is
whose inbox it is, and who changes rules and channels (an owner):

    invana notifications list              --graph ada/arabidopsis --user ada [--unread] [--json]
    invana notifications read              --graph ada/arabidopsis --user ada
    invana notifications rules list        --graph ada/arabidopsis [--json]
    invana notifications rules apply       --file rules.json --graph ada/arabidopsis
    invana notifications channels list     --graph ada/arabidopsis
    invana notifications channels add      ops --kind webhook --target https://… [--secret …] --graph ada/arabidopsis
    invana notifications channels remove   ops --graph ada/arabidopsis

**A rules file is JSON**: one rule or a list, each with the fields of
``POST …/notifications/rules`` — ``name``, ``events``, and optionally ``match``,
``members``, ``roles``, ``requester``, ``in_app``, ``channels``, ``enabled``.
A rule with an existing name is replaced.
"""

from __future__ import annotations

import asyncio
import json

import click
from pydantic import ValidationError as SchemaError

from invana.activity.managers import ChannelManager, InboxManager, NotificationRuleManager
from invana.activity.schemas import ChannelCreate, NotificationRuleWrite
from invana.cli.commands.rules import read_rules_file
from invana.cli.context import graph_options, on_graph

_inbox = InboxManager()
_rules = NotificationRuleManager()
_channels = ChannelManager()


@click.group("notifications")
def notifications_cmd() -> None:
    """Notifications: the inbox, its rules and channels."""


@notifications_cmd.command("list")
@graph_options
@click.option("--unread", is_flag=True, help="Only what is unread.")
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of a table.")
def list_(graph_ref: str, user_ref: str | None, unread: bool, as_json: bool) -> None:
    """Your inbox on the Graph, newest first."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            page = await _inbox.inbox(session, graph=graph, user=actor, unread=unread)
        if as_json:
            click.echo(page.model_dump_json(indent=2))
            return
        click.echo(f"{page.unread} unread · {page.approvals_waiting} approvals waiting on you")
        for n in page.items:
            mark = " " if n.read_at else "•"
            click.echo(f"{mark} {n.created_at.isoformat()}\t{n.kind}\t{n.title}")

    asyncio.run(go())


@notifications_cmd.command("read")
@graph_options
def read(graph_ref: str, user_ref: str | None) -> None:
    """Mark everything in your inbox read."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            marked = await _inbox.mark_read(session, graph=graph, user=actor, ids=None)
        click.echo(f"marked\t{marked}")

    asyncio.run(go())


@notifications_cmd.group("rules")
def rules_group() -> None:
    """Which events reach whom, on which channels."""


@rules_group.command("list")
@graph_options
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of a table.")
def rules_list(graph_ref: str, user_ref: str | None, as_json: bool) -> None:
    """Every rule on the Graph."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            rows = [_rules.read(r) for r in await _rules.list(session, graph=graph)]
        if as_json:
            click.echo(json.dumps([r.model_dump(mode="json") for r in rows], indent=2))
            return
        for r in rows:
            state = "on" if r.enabled else "off"
            click.echo(f"{r.name}\t{state}\t{' · '.join(r.events)}\t{len(r.channel_ids)} channel(s)")

    asyncio.run(go())


@rules_group.command("apply")
@click.option("--file", "path", required=True, help="A JSON rules file: one rule or a list.")
@graph_options
def rules_apply(path: str, graph_ref: str, user_ref: str | None) -> None:
    """Create or replace each rule in --file, by name."""
    try:
        payloads = [NotificationRuleWrite(**raw) for raw in read_rules_file(path)]
    except SchemaError as exc:
        raise click.ClickException(str(exc)) from exc

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            names = [(await _rules.apply(session, graph=graph, payload=p, actor_id=actor.id)).name for p in payloads]
        for name in names:
            click.echo(f"applied\t{name}")

    asyncio.run(go())


@notifications_cmd.group("channels")
def channels_group() -> None:
    """Where notifications go outside the inbox: email · slack · webhook."""


@channels_group.command("list")
@graph_options
def channels_list(graph_ref: str, user_ref: str | None) -> None:
    """Every channel, its masked target, and whether it can send."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            rows = [_channels.read(r) for r in await _channels.list(session, graph=graph)]
        for r in rows:
            click.echo(f"{r.name}\t{r.kind}\t{r.target}\t{'ready' if r.ready else r.reason}")

    asyncio.run(go())


@channels_group.command("add")
@click.argument("name")
@click.option("--kind", type=click.Choice(["email", "slack", "webhook"]), required=True)
@click.option("--target", required=True, help="Email addresses, comma-separated, or the URL to post to.")
@click.option("--secret", default=None, help="A webhook's signing secret.")
@graph_options
def channels_add(name: str, kind: str, target: str, secret: str | None, graph_ref: str, user_ref: str | None) -> None:
    """Add channel NAME."""
    try:
        payload = ChannelCreate(name=name, kind=kind, target=target, secret=secret)
    except SchemaError as exc:
        raise click.ClickException(str(exc)) from exc

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            row = _channels.read(await _channels.create(session, graph=graph, payload=payload, actor_id=actor.id))
        click.echo(f"added\t{row.name}\t{row.kind}\t{row.target}")

    asyncio.run(go())


@channels_group.command("remove")
@click.argument("name")
@graph_options
def channels_remove(name: str, graph_ref: str, user_ref: str | None) -> None:
    """Remove channel NAME; refused while a rule or a schedule uses it."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            await _channels.delete(session, graph=graph, ref=name, actor_id=actor.id)
        click.echo(f"removed\t{name}")

    asyncio.run(go())
