"""`invana schedules …` — a Graph's schedules, from a terminal.

docs/for-developers/modules/operate/features/schedules.md. Every command names
the Graph; ``--user`` is who acts and defaults to the Graph's owner:

    invana schedules list     --graph ada/arabidopsis [--json]
    invana schedules create   --file digest.json --graph ada/arabidopsis
    invana schedules show     "morning digest" --graph ada/arabidopsis
    invana schedules pause    "morning digest" --graph ada/arabidopsis
    invana schedules resume   "morning digest" --graph ada/arabidopsis
    invana schedules run-now  "morning digest" --graph ada/arabidopsis
    invana schedules delete   "morning digest" --graph ada/arabidopsis

**A schedule file is JSON** with the fields of ``POST …/schedules``: ``name``,
``agent``, ``instructions``, ``cron``, and optionally ``timezone``, ``missed``,
``overlap``, ``recipients``, ``channels``, ``approve_outward``, ``approvers``.
``create`` updates the schedule that already has the file's name. ``run-now``
queues a firing; the engine's clock opens its run on its next tick.
"""

from __future__ import annotations

import asyncio
import json

import click
from pydantic import ValidationError as SchemaError

from invana.activity.managers import ScheduleManager
from invana.activity.schemas import ScheduleCreate
from invana.cli.commands.rules import read_rules_file
from invana.cli.context import graph_options, on_graph

_schedules = ScheduleManager()


def _line(row) -> str:
    following = row.next_fire_at.isoformat() if row.next_fire_at else "—"
    return f"{row.name}\t{row.status}\t{row.cron} {row.timezone}\tnext {following}"


@click.group("schedules")
def schedules_cmd() -> None:
    """Schedules: an agent and instructions on a cron — list, create, show, pause, resume, run-now, delete."""


@schedules_cmd.command("list")
@graph_options
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of a table.")
def list_(graph_ref: str, user_ref: str | None, as_json: bool) -> None:
    """Every schedule on the Graph, with its next firing."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            rows = [_schedules.read(r) for r in await _schedules.list(session, graph=graph)]
        if as_json:
            click.echo(json.dumps([r.model_dump(mode="json") for r in rows], indent=2))
            return
        for row in rows:
            click.echo(_line(row))

    asyncio.run(go())


@schedules_cmd.command("create")
@click.option("--file", "path", required=True, help="A JSON schedule file.")
@graph_options
def create(path: str, graph_ref: str, user_ref: str | None) -> None:
    """Create the schedule in --file, or update the one with its name."""
    [raw, *rest] = read_rules_file(path)
    if rest:
        raise click.ClickException("A schedule file holds one schedule.")
    try:
        payload = ScheduleCreate(**raw)
    except SchemaError as exc:
        raise click.ClickException(str(exc)) from exc

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            row = _schedules.read(await _schedules.apply(session, graph=graph, payload=payload, actor_id=actor.id))
        click.echo(_line(row))

    asyncio.run(go())


@schedules_cmd.command("show")
@click.argument("schedule")
@graph_options
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of text.")
def show(schedule: str, graph_ref: str, user_ref: str | None, as_json: bool) -> None:
    """SCHEDULE (a name or an id) and its latest firings."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            row = _schedules.read(await _schedules.get(session, graph=graph, ref=schedule))
            firings = await _schedules.firings(session, graph=graph, ref=schedule, limit=20)
        if as_json:
            click.echo(json.dumps(row.model_dump(mode="json"), indent=2))
            return
        click.echo(_line(row))
        click.echo(row.instructions)
        for f in firings:
            flag = " · catch-up" if f.catch_up else (" · run now" if f.manual else "")
            click.echo(f"  {f.due_at.isoformat()}\t{f.outcome}{flag}\t{f.run_id or ''}\t{f.reason}")

    asyncio.run(go())


_HELP = {
    "pause": "Stop SCHEDULE firing; its history stays.",
    "resume": "Fire SCHEDULE again, from now.",
    "run-now": "Queue a firing of SCHEDULE now; the engine opens its run on its next tick.",
    "delete": "Delete SCHEDULE and its firings. The runs stay.",
}


def _act(name: str, verb: str):
    @schedules_cmd.command(name, help=_HELP[name])
    @click.argument("schedule")
    @graph_options
    def command(schedule: str, graph_ref: str, user_ref: str | None) -> None:
        async def go() -> None:
            async with on_graph(graph_ref, user_ref) as (session, graph, actor):
                act = getattr(_schedules, verb)
                result = await act(session, graph=graph, ref=schedule, actor_id=actor.id)
            click.echo(f"{name}\t{schedule}" + (f"\tfiring {result.id}" if verb == "run_now" else ""))

        asyncio.run(go())

    return command


for _name, _verb in (("pause", "pause"), ("resume", "resume"), ("run-now", "run_now"), ("delete", "delete")):
    _act(_name, _verb)
