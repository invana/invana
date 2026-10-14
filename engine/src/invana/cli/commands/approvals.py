"""`invana approvals …` — what waits on a person to leave Invana.

docs/for-developers/modules/operate/features/approvals.md. ``--user`` is the
approver; only a named one may decide, and a decided or expired approval is
refused:

    invana approvals list     --graph ada/arabidopsis --user ada [--all] [--json]
    invana approvals approve  <id> --note "looks right" --graph ada/arabidopsis --user ada
    invana approvals decline  <id> --note "wrong channel" --graph ada/arabidopsis --user ada
"""

from __future__ import annotations

import asyncio
import json

import click

from invana.activity.managers import ApprovalManager
from invana.activity.schemas import ApprovalRead
from invana.cli.context import graph_options, on_graph

_approvals = ApprovalManager()


@click.group("approvals")
def approvals_cmd() -> None:
    """Approvals: what waits on you before it is sent — list, approve, decline."""


@approvals_cmd.command("list")
@graph_options
@click.option("--all", "everything", is_flag=True, help="Every approval on the Graph, not only yours and pending.")
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of a table.")
def list_(graph_ref: str, user_ref: str | None, everything: bool, as_json: bool) -> None:
    """Pending approvals that name you, nearest deadline first."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            rows = await _approvals.list(
                session, graph=graph, status=None if everything else "pending", mine=None if everything else actor
            )
            reads = [ApprovalRead.model_validate(r) for r in rows]
        if as_json:
            click.echo(json.dumps([r.model_dump(mode="json") for r in reads], indent=2))
            return
        for r in reads:
            click.echo(f"{r.id}\t{r.status}\tby {r.deadline_at.isoformat()}\t{r.title}")

    asyncio.run(go())


def _decide(name: str, approve: bool):
    @approvals_cmd.command(
        name, help="Approve APPROVAL_ID: what it holds is sent." if approve else "Decline APPROVAL_ID: nothing is sent."
    )
    @click.argument("approval_id")
    @click.option("--note", default="", help="Why, recorded with the decision.")
    @graph_options
    def command(approval_id: str, note: str, graph_ref: str, user_ref: str | None) -> None:
        async def go() -> None:
            async with on_graph(graph_ref, user_ref) as (session, graph, actor):
                row = await _approvals.decide(
                    session, graph=graph, approval_id=approval_id, user=actor, approve=approve, note=note
                )
                line = f"{row.status}\t{row.id}\t{row.title}"
            click.echo(line)

        asyncio.run(go())

    return command


_decide("approve", True)
_decide("decline", False)
