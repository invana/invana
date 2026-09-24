"""Committing, removing and previewing a stitch are runs, under the Graph's guardrails (ST54 · ST55 · ST56).

The drawer and `invana stitches commit` open `stitch-commit@1`; removing an
active stitch opens `stitch-withdraw@1`. Each step asks the frozen lens before
it writes (ST53 — `test_writes.py` holds the admission itself). Real Postgres,
no mocks; nothing here reaches a graph database — a refused withdrawal stops
before the connector is touched.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphConnection
from invana.apps.modeller import links as link_service
from invana.apps.modeller.models import GraphModel, GraphVersion, ModelLink
from invana.core.errors import ConflictError, PermissionDeniedError
from invana.runtime.catalogue import stitching
from invana.runtime.catalogue.contract import CannotAnswer
from invana.runtime.models import RunStatus
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.services import open_stitch_commit_run, open_stitch_preview_run, open_stitch_withdraw_run
from tests.govern.test_writes import _writes

CONNECTOR = "invana.graph.connectors.neo4j.connector.Neo4jConnector"


async def _staged(session: AsyncSession, graph: Graph, *, read_only: bool = False, status: str = "staged") -> ModelLink:
    session.add(
        GraphConnection(graph_id=graph.id, uri="bolt://localhost:7687", connector_class=CONNECTOR, read_only=read_only)
    )
    model = GraphModel(graph_id=graph.id, name="Deals", description="", package_id="deals")
    session.add(model)
    await session.flush()
    version = GraphVersion(model_id=model.id, version="1.0.0", status="active", axes={})
    session.add(version)
    await session.flush()
    link = ModelLink(
        graph_id=graph.id,
        kind="anchor",
        status=status,
        source_version_id=version.id,
        source_type="Deal",
        source_property="id",
        target_version_id=version.id,
        target_type="Deal",
        target_property="ref",
    )
    session.add(link)
    await session.flush()
    return link


async def test_a_commit_opens_the_stitch_commit_plan_with_the_guardrails_frozen(
    session: AsyncSession, graph: Graph
) -> None:
    await _staged(session, graph)

    run = await open_stitch_commit_run(session, graph=graph, actor_id=None)

    assert run.status == RunStatus.queued.value
    assert run.workflow_key == "stitch-commit@1"
    assert run.lens_snapshot is not None
    nodes = await TaskRunQuerySet().nodes_of(session, run_id=run.id)
    assert [n.task_key for n in nodes] == ["commit_stitches"]


async def test_nothing_staged_never_starts_a_run(session: AsyncSession, graph: Graph) -> None:
    with pytest.raises(ConflictError) as exc:
        await open_stitch_commit_run(session, graph=graph, actor_id=None)
    assert exc.value.detail["error"] == "nothing_staged"


async def test_a_read_only_connection_is_refused_before_the_run(session: AsyncSession, graph: Graph) -> None:
    await _staged(session, graph, read_only=True)

    with pytest.raises(PermissionDeniedError):
        await open_stitch_commit_run(session, graph=graph, actor_id=None)


async def test_removing_an_active_stitch_opens_the_withdraw_plan(session: AsyncSession, graph: Graph) -> None:
    link = await _staged(session, graph, status="active")

    run = await open_stitch_withdraw_run(session, graph=graph, link_id=link.id, actor_id=None)

    assert run.workflow_key == "stitch-withdraw@1"
    nodes = await TaskRunQuerySet().nodes_of(session, run_id=run.id)
    assert [(n.task_key, (n.args or {}).get("link_id")) for n in nodes] == [("withdraw_stitch", link.id)]


async def test_a_guardrail_denying_its_model_keeps_the_rule_and_its_edges(
    session: AsyncSession, db_engine, graph: Graph
) -> None:
    """ST55: the refusal comes before the connector is touched and before the row goes."""
    link = await _staged(session, graph, status="active")
    writes, _ = await _writes(session, db_engine, graph, rules=[{"match": "graph_data/model/Deals@*", "allow": False}])

    with pytest.raises(CannotAnswer):
        await stitching.withdraw_stitch(session, graph_id=graph.id, link=link, connector=None, admit=writes.admit)

    assert await link_service.get_link(session, graph.id, link.id) is not None


async def test_a_preview_is_a_run_whether_one_rule_or_every_stitch(session: AsyncSession, graph: Graph) -> None:
    """ST56: the drawer's one draft rule and `stitches resolve` open the same plan."""
    rule = {
        "source_type": "Deal",
        "source_property": "carrier_iata",
        "target_type": "Airline",
        "target_property": "iata",
        "identity_match": "exact",
    }

    one = await open_stitch_preview_run(session, graph=graph, actor_id=None, rule=rule)
    every = await open_stitch_preview_run(session, graph=graph, actor_id=None)

    assert one.workflow_key == every.workflow_key == "stitch-preview@1"
    assert one.lens_snapshot is not None
    [step] = await TaskRunQuerySet().nodes_of(session, run_id=one.id)
    assert (step.task_key, step.args["rules"]) == ("preview_stitches", [rule])
    [step] = await TaskRunQuerySet().nodes_of(session, run_id=every.id)
    assert step.args["all_links"] is True
