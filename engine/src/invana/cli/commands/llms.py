"""`invana llms …` — the Graph's LLM endpoints and the exact model versions they offer.

docs/for-developers/modules/agents/features/pinned-model-versions.md. An address
printed here is what ``invana agents pin --model`` and a skill's pin take:

    invana llms list   --graph demo/airways
    invana llms models --graph demo/airways anthropic-prod
"""

from __future__ import annotations

import asyncio

import click

from invana.apps.llm_providers.managers import LLMProviderManager
from invana.cli.context import graph_options, on_graph

_providers = LLMProviderManager()


@click.group("llms")
def llms_cmd() -> None:
    """LLM endpoints and their model versions."""


@llms_cmd.command("list")
@graph_options
def list_(graph_ref: str, user_ref: str | None) -> None:
    """Every endpoint, its vendor and how many models it offers."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            for provider in await _providers.list_for_graph(session, graph_id=graph.id):
                models = await _providers.list_models(session, provider=provider, active_only=True)
                click.echo(f"{provider.name}\t{provider.provider}\t{len(models)} models")

    asyncio.run(go())


@llms_cmd.command("models")
@graph_options
@click.argument("endpoint")
def models(graph_ref: str, user_ref: str | None, endpoint: str) -> None:
    """The model versions one endpoint offers, as the addresses a pin takes."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            found = [p for p in await _providers.list_for_graph(session, graph_id=graph.id) if p.name == endpoint]
            if not found:
                raise click.UsageError(f"No endpoint {endpoint!r} — `invana llms list` names them.")
            for model in await _providers.list_models(session, provider=found[0]):
                click.echo(f"llm/{endpoint}/{model.model_id}\t{model.status}")

    asyncio.run(go())
