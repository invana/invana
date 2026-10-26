"""`invana requests …` — what people and agents asked to be modelled or allowed.

docs/for-developers/modules/govern/features/requests.md. The inbox is filed by
the engine where an ask fails; this reads it and resolves it, the same three
ways the Requests page does:

    invana requests list     --graph ada/airways [--status open|done] [--kind guardrail] [--json]
    invana requests resolve  <id> --decline                --graph ada/airways
    invana requests resolve  <id> --allow "EU · H1 2026"    --graph ada/airways
    invana requests resolve  <id> --model [Fares]          --graph ada/airways

The command runs as the operator, so it resolves as a modeller would.
"""

from __future__ import annotations

import asyncio
import json

import click

from invana.apps.govern.managers import LensManager, RequestManager
from invana.apps.govern.models import LensKind
from invana.apps.govern.schemas import REQUEST_LIST, RequestResolve
from invana.cli.context import graph_options, on_graph
from invana.core.lists.params import parse_list_params

_requests = RequestManager()
_lenses = LensManager()


@click.group("requests")
def requests_cmd() -> None:
    """Requests: the inbox of asks the Graph could not serve — list, resolve."""


@requests_cmd.command("list")
@graph_options
@click.option("--status", type=click.Choice(["open", "done"]), default=None, help="Only open, or only done.")
@click.option("--kind", type=click.Choice(["guardrail", "unanswered", "change"]), default=None)
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of a table.")
def list_(graph_ref: str, user_ref: str | None, status: str | None, kind: str | None, as_json: bool) -> None:
    """Newest ask first, with the Graph's open count."""
    query = {k: [v] for k, v in (("status", status), ("kind", kind)) if v}

    async def go():
        async with on_graph(graph_ref, user_ref) as (session, graph, _actor):
            params = parse_list_params(REQUEST_LIST, query)

            async def no_names(_rows):
                return {}

            return await _requests.page(
                session, graph_id=graph.id, params=params, applied=[], agent_names=no_names, may_resolve=True
            )

    page = asyncio.run(go())
    if as_json:
        click.echo(json.dumps(page.model_dump(mode="json"), indent=2))
        return
    for r in page.items:
        why = f"blocked by {r.blocked_by}" if r.blocked_by else r.kind
        state = r.status if r.status == "open" else (r.resolution_note or r.status)
        click.echo(f"{r.id}\t{state}\t{r.asks} asks\t{why}\t{r.title}")
    click.echo(f"{page.open} open · {page.total} listed")


@requests_cmd.command("resolve")
@click.argument("request_id")
@click.option("--decline", "decline", is_flag=True, help="Done, declined.")
@click.option("--allow", "world_ref", default=None, help="Allow in this world (its name or id).")
@click.option(
    "--model", "model_ref", is_flag=False, flag_value="", default=None, help="Modelled — optionally naming the model."
)
@click.option("--note", default=None, help="What was done, when declining or modelling without a model.")
@graph_options
def resolve(
    request_id: str,
    decline: bool,
    world_ref: str | None,
    model_ref: str | None,
    note: str | None,
    graph_ref: str,
    user_ref: str | None,
) -> None:
    """Resolve REQUEST_ID — exactly one of --decline, --allow, --model."""
    chosen = [decline, world_ref is not None, model_ref is not None]
    if sum(chosen) != 1:
        raise click.UsageError("Pick exactly one of --decline, --allow <world>, --model [<model>].")

    async def go():
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            payload = RequestResolve(action="decline", note=note)
            if world_ref is not None:
                worlds = await _lenses.list_for_graph(session, graph_id=graph.id, kind=LensKind.world.value)
                world = next((w for w in worlds if world_ref in (w.id, w.name, w.key)), None)
                if world is None:
                    raise click.UsageError(f"No world {world_ref!r} in this Graph.")
                payload = RequestResolve(action="allow", world_id=world.id)
            elif model_ref is not None:
                model_id = None
                if model_ref:
                    model = await _requests.requests_qs.model_by_ref(session, graph_id=graph.id, ref=model_ref)
                    if model is None:
                        raise click.UsageError(f"No model {model_ref!r} in this Graph.")
                    model_id = model.id
                payload = RequestResolve(action="model", model_id=model_id, note=note)
            row = await _requests.resolve(
                session,
                request=await _requests.get(session, graph_id=graph.id, request_id=request_id),
                payload=payload,
                actor_id=actor.id,
                may_resolve=True,
            )
            return f"{row.status}\t{row.id}\t{row.resolution_note}"

    click.echo(asyncio.run(go()))
