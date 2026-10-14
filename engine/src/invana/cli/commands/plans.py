"""`invana plans …` — the Graph's plans, read-only.

docs/for-developers/modules/workflows/features/the-library.md. A plan is
generated from a skill's text or packaged with Invana; nobody writes one by
hand, so there is nothing here to edit:

    invana plans list --graph demo/airways
    invana plans show --graph demo/airways <plan-id>
"""

from __future__ import annotations

import asyncio

import click

from invana.apps.task_plans.managers import TaskPlanManager
from invana.cli.context import graph_options, on_graph

_plans = TaskPlanManager()


@click.group("plans")
def plans_cmd() -> None:
    """Generated and packaged plans, read-only."""


@plans_cmd.command("list")
@graph_options
def list_(graph_ref: str, user_ref: str | None) -> None:
    """Every plan: id, origin, key and version, name."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            for plan in await _plans.list_for_graph(session, graph_id=graph.id):
                key = f"{plan.key}@{plan.version}" if plan.key else "—"
                click.echo(f"{plan.id}\t{plan.origin}\t{key}\t{plan.name}")

    asyncio.run(go())


@plans_cmd.command("show")
@graph_options
@click.argument("plan_id")
def show(graph_ref: str, user_ref: str | None, plan_id: str) -> None:
    """One plan's steps, in order, with what each waits on."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            plan = await _plans.get(session, plan_id)
            if plan is None or plan.graph_id != graph.id:
                raise click.UsageError(f"No plan {plan_id!r} in this Graph.")
            click.echo(f"{plan.name} · {plan.origin}" + (f" · {plan.key}@{plan.version}" if plan.key else ""))
            for task in await _plans.tasks_for(session, plan_id=plan.id):
                after = f"\tafter {', '.join(task.depends_on)}" if task.depends_on else ""
                click.echo(f"  {task.key}\t{task.step_key or task.form}\t{task.title}{after}")

    asyncio.run(go())
