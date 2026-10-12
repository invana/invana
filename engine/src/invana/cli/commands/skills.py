"""`invana skills …` — write a skill's instructions, draw its plan, publish and roll back.

docs/for-developers/modules/skills/features/instructions-publish-rollback.md.
The text is the source; the plan is drawn from it. So ``push`` writes the
draft **and draws it**, in this process, and prints what the draw left — a
drawn plan, a question to answer in Studio, or the reason it refused:

    invana skills list    --graph demo/airways
    invana skills history --graph demo/airways "Route finder"
    invana skills push    --graph demo/airways "Route finder" --instructions route-finder.md
    invana skills publish --graph demo/airways "Route finder" --why "names the airline"
    invana skills rollback --graph demo/airways "Route finder" --to 3 --why "v4 cited nothing"

``publish`` and ``rollback`` pass the eval gate exactly as Studio's do: a set
with active cases needs a settled eval run over this candidate first
(``invana evals run --draft``).
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import click

from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import SkillVersionPublish
from invana.cli.context import graph_options, on_graph, with_runtime
from invana.runtime.managers import SkillDraftManager

_skills = SkillManager()
_drafts = SkillDraftManager()


@click.group("skills")
def skills_cmd() -> None:
    """Skills: write the instructions, draw the plan, publish, roll back."""


async def skill_named(session, graph, name: str):
    """The skill called ``name`` in this Graph, or a usage error listing what is there."""
    found = [s for s in await _skills.list_for_graph(session, graph_id=graph.id) if s.name == name]
    if not found:
        raise click.UsageError(f"No skill {name!r} in this Graph — `invana skills list` names them.")
    return found[0]


@skills_cmd.command("list")
@graph_options
def list_(graph_ref: str, user_ref: str | None) -> None:
    """Every skill, its published version and its pinned model."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            for skill in await _skills.list_for_graph(session, graph_id=graph.id):
                head = skill.current_version
                pin = head.model_pin if head is not None and head.model_pin else "—"
                click.echo(f"{skill.name}\tv{head.version if head else 0}\t{pin}")

    asyncio.run(go())


@skills_cmd.command("history")
@graph_options
@click.argument("name")
def history(graph_ref: str, user_ref: str | None, name: str) -> None:
    """Every published version, newest first, with what it restored."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            skill = await skill_named(session, graph, name)
            for v in await _skills.list_versions(session, skill=skill):
                if v.is_draft:
                    continue
                restored = f"\trestores v{v.restored_from_version}" if v.restored_from_version else ""
                click.echo(f"v{v.version}\t{v.published_at:%Y-%m-%d %H:%M}\t{v.model_pin or '—'}{restored}")

    asyncio.run(go())


@skills_cmd.command("push")
@graph_options
@click.argument("name")
@click.option(
    "--instructions",
    "path",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="The instructions.md to write as the draft.",
)
def push(graph_ref: str, user_ref: str | None, name: str, path: Path) -> None:
    """Write the file as the skill's draft, then draw its plan."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            skill = await skill_named(session, graph, name)
            await _drafts.write_draft(session, skill=skill, payload=SkillVersionPublish(content=path.read_text()))
            run = await _drafts.start_draw(session, graph=graph, skill=skill, actor_id=actor.id)
            run_id = run.id
        click.echo(f"drawing {run_id}", err=True)
        async with with_runtime() as runtime:
            await runtime.run_inline(run_id)
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            draft = await _drafts.draft_read(session, skill=await skill_named(session, graph, name))
        if draft.refusal is not None:
            raise click.ClickException("The draw refused: " + "; ".join(draft.refusal.reasons))
        if draft.open_clarification is not None:
            click.echo(f"asks: {draft.open_clarification.question} — answer it in Studio, then push again.")
            raise SystemExit(2)
        click.echo(f"drawn — {len(draft.plan.nodes)} steps; `invana skills publish` when ready.")

    asyncio.run(go())


@skills_cmd.command("publish")
@graph_options
@click.argument("name")
@click.option("--why", default=None, help="Why — kept on the publish event; needed past an eval warning.")
def publish(graph_ref: str, user_ref: str | None, name: str, why: str | None) -> None:
    """Publish the drawn draft as the next version."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            skill = await skill_named(session, graph, name)
            payload = SkillVersionPublish(why=why)
            version = await _drafts.publish(session, skill=skill, payload=payload, actor_id=actor.id)
            click.echo(f"{name} v{version.version} published.")

    asyncio.run(go())


@skills_cmd.command("rollback")
@graph_options
@click.argument("name")
@click.option("--to", "version", type=int, required=True, help="The version to restore, as the next one.")
@click.option("--why", default=None, help="Why — kept on the rollback event.")
def rollback(graph_ref: str, user_ref: str | None, name: str, version: int, why: str | None) -> None:
    """Restore an earlier version as the next one; nothing is rewritten."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            skill = await skill_named(session, graph, name)
            restored = await _drafts.rollback(session, skill=skill, version=version, actor_id=actor.id, why=why)
            click.echo(f"{name} v{restored.version} published, restoring v{version}.")

    asyncio.run(go())
