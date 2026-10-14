"""`invana evals …` — replay a skill's or an agent's eval set, promote real asks, run the drift pass.

docs/for-developers/modules/skills/features/evals.md. An eval run is worked in
this process, one replay after another, and then scored — the same run Studio
opens, awaited here because there is no server to hand it to:

    invana evals list    --graph demo/airways --skill "Route finder"
    invana evals run     --graph demo/airways --skill "Route finder" --draft
    invana evals run     --graph demo/airways --agent Analyst --draft --pin llm/anthropic-prod/claude-opus-5-5
    invana evals promote --graph demo/airways --skill "Route finder" <run-id> --as passing
    invana evals drift   --graph demo/airways

``drift`` is the nightly pass for an external cron until shared schedules
exist: a live eval run for every set with active cases. A run worse than the
subject's last live run emits ``eval.degraded``, which lands in Activity.

Exit codes a scheduler can branch on: ``run`` exits 1 when the gate blocks and
3 when it warns.
"""

from __future__ import annotations

import asyncio

import click

from invana.cli.commands.agents import agent_named
from invana.cli.commands.skills import skill_named
from invana.cli.context import graph_options, on_graph, with_runtime
from invana.runtime.managers import EvalManager

_evals = EvalManager()


@click.group("evals")
def evals_cmd() -> None:
    """Eval sets: replay them, promote real asks into cases, run the drift pass."""


def subject_options(fn):
    fn = click.option("--agent", "agent_name", default=None, help="The agent whose set it is.")(fn)
    return click.option("--skill", "skill_name", default=None, help="The skill whose set it is.")(fn)


async def _subject(session, graph, skill_name: str | None, agent_name: str | None) -> tuple[str, str]:
    if bool(skill_name) == bool(agent_name):
        raise click.UsageError("Name one subject: --skill or --agent.")
    if skill_name:
        return "skill", (await skill_named(session, graph, skill_name)).id
    return "agent", (await agent_named(session, graph, agent_name)).id


def _sides(result: dict) -> str:
    out = []
    for side, n in (result.get("eval") or {}).get("sides", {}).items():
        judged = f" · judged {n['judged_mean']}" if n.get("judged_mean") is not None else ""
        out.append(
            f"  {side}: hard {n['hard_passed']}/{n['hard_total']} · p95 {n['p95_ms']} ms · {n['tokens']} tokens{judged}"
        )
    return "\n".join(out)


@evals_cmd.command("list")
@graph_options
@subject_options
def list_(graph_ref: str, user_ref: str | None, skill_name: str | None, agent_name: str | None) -> None:
    """The set's cases, then its eval runs, newest first."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            kind, subject_id = await _subject(session, graph, skill_name, agent_name)
            eval_set = await _evals.get_set(session, graph_id=graph.id, subject_kind=kind, subject_id=subject_id)
            for case in await _evals.cases(session, eval_set=eval_set):
                checks = ",".join(c["kind"] for c in case.checks) or "—"
                click.echo(f"case {case.id}\t{case.status}\t{case.label}\t{checks}\t{case.question}")
            for run in await _evals.runs(session, graph_id=graph.id, subject_kind=kind, subject_id=subject_id):
                trigger = (run.params or {}).get("trigger", "")
                at = f"{run.created_at:%Y-%m-%d %H:%M}"
                click.echo(f"run  {run.id}\t{run.status}\t{run.outcome or '—'}\t{trigger}\t{at}")

    asyncio.run(go())


@evals_cmd.command("run")
@graph_options
@subject_options
@click.option("--draft", is_flag=True, help="Replay the candidate beside live; without it, live only.")
@click.option("--version", type=int, default=None, help="With --draft: a version a rollback would restore.")
@click.option("--pin", "model_pin", default=None, help="With --draft: the model address a pin move would set.")
def run(
    graph_ref: str,
    user_ref: str | None,
    skill_name: str | None,
    agent_name: str | None,
    draft: bool,
    version: int | None,
    model_pin: str | None,
) -> None:
    """Replay every active case and print each side's numbers and the gate's verdict."""
    if (version is not None or model_pin) and not draft:
        raise click.UsageError("--version and --pin name a candidate; add --draft.")

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            kind, subject_id = await _subject(session, graph, skill_name, agent_name)
            opened = await _evals.open_run(
                session,
                graph_id=graph.id,
                subject_kind=kind,
                subject_id=subject_id,
                side="both" if draft else "live",
                actor_id=actor.id,
                trigger="manual",
                version=version,
                model_pin=model_pin,
            )
            run_id = opened.id
        click.echo(f"eval run {run_id}", err=True)
        async with with_runtime() as runtime:
            await runtime.eval_inline(run_id)
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            root, _results = await _evals.run(
                session, graph_id=graph.id, subject_kind=kind, subject_id=subject_id, run_id=run_id
            )
        gate = (root.result or {}).get("eval", {}).get("gate", {})
        click.echo(f"{root.status} · {gate.get('verdict', root.outcome)}")
        click.echo(_sides(root.result or {}))
        for reason in gate.get("reasons", []):
            click.echo(f"  - {reason}")
        if gate.get("verdict") == "blocked":
            raise SystemExit(1)
        if gate.get("verdict") == "warn":
            raise SystemExit(3)

    asyncio.run(go())


@evals_cmd.command("promote")
@graph_options
@subject_options
@click.argument("run_id")
@click.option("--as", "label", type=click.Choice(["passing", "failing"]), required=True)
def promote(
    graph_ref: str, user_ref: str | None, skill_name: str | None, agent_name: str | None, run_id: str, label: str
) -> None:
    """Make a real ask a case — a good answer a regression case, a bad one a failing case."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            kind, subject_id = await _subject(session, graph, skill_name, agent_name)
            case = await _evals.promote(
                session,
                graph_id=graph.id,
                run_id=run_id,
                subject_kind=kind,
                subject_id=subject_id,
                label=label,
                actor_id=actor.id,
            )
            click.echo(f"case {case.id} ({label}): {case.question}")

    asyncio.run(go())


@evals_cmd.command("drift")
@graph_options
@click.option(
    "--trigger",
    type=click.Choice(["nightly", "model_publish", "world_change", "pin_moved"]),
    default="nightly",
    show_default=True,
)
def drift(graph_ref: str, user_ref: str | None, trigger: str) -> None:
    """Re-run every live eval set; a run worse than the last one emits eval.degraded."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            opened = await _evals.drift(session, graph_id=graph.id, trigger=trigger)
            queued = [(r.id, r.label) for r in opened if r.status == "queued"]
            paused = [(r.id, r.label) for r in opened if r.status != "queued"]
        if not opened:
            click.echo("No eval set with an active case — nothing to re-run.")
            return
        for run_id, subject in paused:
            click.echo(f"{run_id}\t{subject}\tpaused: budget")
        async with with_runtime() as runtime:
            for run_id, _subject_key in queued:
                await runtime.eval_inline(run_id)
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            for run_id, subject in queued:
                kind, _, subject_id = subject.partition(":")
                root, _results = await _evals.run(
                    session, graph_id=graph.id, subject_kind=kind, subject_id=subject_id, run_id=run_id
                )
                click.echo(f"{root.id}\t{subject}\t{root.status}")
                click.echo(_sides(root.result or {}))

    asyncio.run(go())
