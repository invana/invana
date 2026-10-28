"""`invana rules …` — the install's rules and a Graph's invariants, from a terminal.

docs/for-developers/modules/skills/features/rules.md. Without ``--graph`` a
command reads or writes the **install** rules, which only an install Admin may
write; with ``--graph`` it is that Graph's invariants:

    invana rules list   --user ada [--graph ada/arabidopsis]
    invana rules show   <rule-id> --user ada [--graph ada/arabidopsis]
    invana rules apply  --file rules.json --user admin [--graph ada/arabidopsis]

**A rules file is JSON**: one rule or a list, each with the fields of
``POST /api/v1/rules`` — ``statement``, ``order?``, ``check?``, ``mode?``, ``because?`` —
plus ``id`` to edit an existing rule and ``active`` to turn one off or on.
An entry without ``id`` creates a rule; one with ``id`` publishes the next
version only when its statement, check or mode changed. A project's working
rules are not applied here: no project act reads a check yet.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import click

from invana.apps.skills.managers import RuleManager
from invana.apps.skills.schemas import RuleCreate, RuleUpdate
from invana.cli.context import as_user, on_graph

_rules = RuleManager()


def read_rules_file(path: str) -> list[dict[str, Any]]:
    file = Path(path)
    if not file.is_file():
        raise click.ClickException(f"Cannot read {path!r}: no such file.")
    try:
        raw = json.loads(file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise click.ClickException(f"{path} is not JSON: {exc}.") from exc
    entries = raw if isinstance(raw, list) else [raw]
    if not all(isinstance(e, dict) for e in entries):
        raise click.ClickException(f"{path} is a rule object or a list of them.")
    return entries


def _line(rule: Any) -> str:
    check = rule.check or {}
    checked = f"\t{check.get('kind')} · {rule.mode}" if check else ""
    state = "" if rule.active else "\tinactive"
    return f"{rule.id}\t{rule.scope}\tv{rule.version}\t{rule.statement}{checked}{state}"


@click.group("rules")
def rules_cmd() -> None:
    """Rules: the install's, or a Graph's invariants — list, show, apply a file."""


@rules_cmd.command("list")
@click.option("--graph", "graph_ref", default=None, help="<username>/<slug>; omitted is the install's rules.")
@click.option("--user", "user_ref", default=None, help="Who reads. Required without --graph.")
def list_(graph_ref: str | None, user_ref: str | None) -> None:
    """The rules in offer order."""

    async def go() -> None:
        if graph_ref is None:
            if user_ref is None:
                raise click.UsageError("--user is required for the install's rules.")
            async with as_user(user_ref) as (session, _):
                for rule in await _rules.install(session):
                    click.echo(_line(rule))
            return
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            for rule in await _rules.install(session):
                click.echo(_line(rule) + "\tinherited")
            for rule in await _rules.invariants(session, graph_id=graph.id):
                click.echo(_line(rule))

    asyncio.run(go())


@rules_cmd.command("show")
@click.argument("rule_id")
@click.option("--graph", "graph_ref", default=None, help="<username>/<slug>; omitted is an install rule.")
@click.option("--user", "user_ref", default=None, help="Who reads. Required without --graph.")
def show(rule_id: str, graph_ref: str | None, user_ref: str | None) -> None:
    """One rule and every version of it, newest first."""

    async def emit(session, rule: Any) -> None:
        click.echo(_line(rule))
        for version in await _rules.list_versions(session, rule=rule):
            checked = f"\t{json.dumps(version.check)} · {version.mode}" if version.check else ""
            click.echo(f"  v{version.version}\t{version.published_at:%Y-%m-%d}\t{version.statement}{checked}")

    async def go() -> None:
        if graph_ref is None:
            if user_ref is None:
                raise click.UsageError("--user is required for an install rule.")
            async with as_user(user_ref) as (session, _):
                await emit(session, await _rules.get_install(session, rule_id=rule_id))
            return
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            await emit(session, await _rules.get(session, rule_id=rule_id, graph_id=graph.id))

    asyncio.run(go())


@rules_cmd.command("apply")
@click.option("--file", "path", required=True, help="A rule, or a list of them, as JSON.")
@click.option("--graph", "graph_ref", default=None, help="<username>/<slug>; omitted is the install's rules.")
@click.option("--user", "user_ref", default=None, help="Who applies. Required without --graph.")
def apply(path: str, graph_ref: str | None, user_ref: str | None) -> None:
    """Create each rule without an id; edit each with one. All or nothing."""
    entries = read_rules_file(path)

    async def one(session, entry: dict[str, Any], *, graph_id: str | None, actor) -> Any:
        fields = {k: v for k, v in entry.items() if k not in {"id", "active"}}
        if entry.get("id"):
            if graph_id is None:
                rule = await _rules.update_install(
                    session, rule_id=entry["id"], payload=RuleUpdate.model_validate(fields), actor=actor
                )
            else:
                rule = await _rules.get(session, rule_id=entry["id"], graph_id=graph_id)
                await _rules.update(session, rule=rule, payload=RuleUpdate.model_validate(fields), actor_id=actor.id)
        elif graph_id is None:
            rule = await _rules.create_install(session, payload=RuleCreate.model_validate(fields), actor=actor)
        else:
            payload = RuleCreate.model_validate(fields)
            rule = await _rules.create(session, graph_id=graph_id, project_id=None, payload=payload, actor_id=actor.id)
        if "active" in entry:
            if graph_id is None:
                await _rules.set_install_active(session, rule_id=rule.id, active=bool(entry["active"]), actor=actor)
            else:
                await _rules.set_active(session, rule=rule, active=bool(entry["active"]), actor_id=actor.id)
        return rule

    async def go() -> None:
        if graph_ref is None:
            if user_ref is None:
                raise click.UsageError("--user is required for the install's rules.")
            async with as_user(user_ref) as (session, actor):
                for entry in entries:
                    click.echo(_line(await one(session, entry, graph_id=None, actor=actor)))
            return
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            for entry in entries:
                click.echo(_line(await one(session, entry, graph_id=graph.id, actor=actor)))

    asyncio.run(go())
