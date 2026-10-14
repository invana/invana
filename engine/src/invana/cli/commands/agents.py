"""`invana agents …` — an agent's instructions as a draft, and its pinned model.

docs/for-developers/modules/skills/features/instructions-publish-rollback.md ·
docs/for-developers/modules/agents/features/pinned-model-versions.md.

    invana agents list    --graph demo/airways
    invana agents push    --graph demo/airways "Analyst" --instructions analyst.md
    invana agents publish --graph demo/airways "Analyst" --why "cites every route"
    invana agents pin     --graph demo/airways "Analyst" --model llm/anthropic-prod/claude-opus-5-5

``publish`` and ``pin`` pass the eval gate the way Studio's do: with active
cases, a settled eval run over this exact candidate comes first —
``invana evals run --agent Analyst --draft`` for the draft,
``… --draft --pin <address>`` for a pin move.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import click

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.schemas import AgentUpdate
from invana.cli.context import graph_options, on_graph
from invana.runtime.managers import EvalManager

_agents = AgentManager()
_evals = EvalManager()


@click.group("agents")
def agents_cmd() -> None:
    """Agents: draft and publish the instructions, pin the model."""


async def agent_named(session, graph, name: str):
    """The agent called ``name`` in this Graph, or a usage error naming the command that lists them."""
    found = [a for a in await _agents.list_agents(session, graph=graph) if a.name == name]
    if not found:
        raise click.UsageError(f"No agent {name!r} in this Graph — `invana agents list` names them.")
    return found[0]


@agents_cmd.command("list")
@graph_options
def list_(graph_ref: str, user_ref: str | None) -> None:
    """Every agent, its version, its pinned model and whether a draft is open."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            for agent in await _agents.list_agents(session, graph=graph):
                draft = "\tdraft open" if agent.instructions_draft is not None else ""
                click.echo(f"{agent.name}\tv{agent.version}\t{agent.model_pin or '—'}{draft}")

    asyncio.run(go())


@agents_cmd.command("push")
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
    """Write the file as the agent's draft; runs keep reading the published instructions."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            agent = await agent_named(session, graph, name)
            await _agents.write_draft(session, agent=agent, instructions=path.read_text())
            click.echo(f"{name}: draft written; `invana agents publish` when ready.")

    asyncio.run(go())


@agents_cmd.command("publish")
@graph_options
@click.argument("name")
@click.option("--why", default=None, help="Why — kept on the publish event; needed past an eval warning.")
def publish(graph_ref: str, user_ref: str | None, name: str, why: str | None) -> None:
    """Publish the draft as the agent's next version."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            agent = await agent_named(session, graph, name)
            evaluated = None
            if agent.instructions_draft is not None:
                evaluated = await _evals.gate(
                    session, graph_id=graph.id, subject_kind="agent", subject_id=agent.id, why=why
                )
            agent = await _agents.publish_instructions(session, agent=agent, actor=actor, why=why, evaluated=evaluated)
            click.echo(f"{name} v{agent.version} published.")

    asyncio.run(go())


@agents_cmd.command("pin")
@graph_options
@click.argument("name")
@click.option("--model", "address", required=True, help="An exact model version's address — never an alias.")
@click.option("--why", default=None, help="Why — kept on the update event; needed past an eval warning.")
def pin(graph_ref: str, user_ref: str | None, name: str, address: str, why: str | None) -> None:
    """Pin the agent to one model version; the eval gate reads the new pin first."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            agent = await agent_named(session, graph, name)
            if agent.model_pin == address:
                click.echo(f"{name} is already pinned to {address}.")
                return
            evaluated = await _evals.gate(
                session,
                graph_id=graph.id,
                subject_kind="agent",
                subject_id=agent.id,
                model_pin=address,
                unchanged_pin=False,
                why=why,
            )
            payload = AgentUpdate(model_pin=address, why=why)
            agent = await _agents.update_agent(session, agent=agent, payload=payload, actor=actor, evaluated=evaluated)
            click.echo(f"{name} v{agent.version} pinned to {agent.model_pin}.")

    asyncio.run(go())
