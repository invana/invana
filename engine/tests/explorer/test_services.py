"""Explorer node-expand, as a run (docs/for-developers/modules/explore/features/graph-canvas.md
GC6 · GC12), against a real Neo4j.

Each expansion opens `expand-neighbours@1`, runs inline and answers with the
shape the canvas draws, plus the run's id. Reading under a world is the
connector suite's (`tests/graph/connectors/neighbour_lens.py`).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from invana.apps.explorer.schemas import (
    ExpandByEdgeTypeRequest,
    ExpandByNodeTypeRequest,
    ExpandNeighborsRequest,
)
from invana.graph.types.sort import SortDirection, SortSpec
from invana.runtime import canvas
from invana.runtime.models import RunStatus, TaskRun, TriggeredBy

pytestmark = pytest.mark.asyncio


async def _expand(session, runtime, graph, user, req):
    return await canvas.expand(session, runtime=runtime, graph=graph, actor_id=user.id, req=req)


async def test_an_expansion_is_a_run_and_answers_with_what_it_read(session, runtime, graph, user, seeded_graph):
    alice = seeded_graph["alice"]
    result = await _expand(session, runtime, graph, user, ExpandNeighborsRequest(vertex_id=alice.id, limit=2))

    assert result.total == 3  # Bob, Charlie, Acme
    assert result.returned == 2
    assert result.has_more is True
    run = await session.get(TaskRun, result.run_id)
    assert (run.status, run.triggered_by) == (RunStatus.succeeded.value, TriggeredBy.canvas.value)


async def test_by_node_type(session, runtime, graph, user, seeded_graph):
    alice = seeded_graph["alice"]
    req = ExpandByNodeTypeRequest(vertex_id=alice.id, neighbor_label="Company")
    result = await _expand(session, runtime, graph, user, req)
    assert (result.total, result.returned, result.has_more) == (1, 1, False)
    assert {n.label for n in result.data.nodes if n.id != alice.id} == {"Company"}


async def test_by_edge_type_paginated(session, runtime, graph, user, seeded_graph):
    alice = seeded_graph["alice"]
    sort = [SortSpec(property="name", direction=SortDirection.ASC)]
    page1 = ExpandByEdgeTypeRequest(vertex_id=alice.id, edge_label="KNOWS", sort=sort, limit=1, offset=0)
    page2 = ExpandByEdgeTypeRequest(vertex_id=alice.id, edge_label="KNOWS", sort=sort, limit=1, offset=1)
    r1 = await _expand(session, runtime, graph, user, page1)
    r2 = await _expand(session, runtime, graph, user, page2)
    assert (r1.total, r1.has_more, r2.has_more) == (2, True, False)
    assert [n.properties["name"] for n in r1.data.nodes if n.id != alice.id] == ["Bob"]
    assert [n.properties["name"] for n in r2.data.nodes if n.id != alice.id] == ["Charlie"]


async def test_limit_over_max_rejected():
    with pytest.raises(ValidationError):
        ExpandNeighborsRequest(vertex_id="v1", limit=501)


async def test_edge_type_requires_label():
    with pytest.raises(ValidationError):
        ExpandByEdgeTypeRequest(vertex_id="v1", edge_label="")


async def test_type_counts_are_a_run(session, runtime, graph, user, seeded_graph):
    result = await canvas.count_types(session, runtime=runtime, graph=graph, actor_id=user.id, lens_id=None)
    assert {t.name: t.count for t in result.nodes} == {"Person": 3, "Company": 1}
    assert {t.name: t.count for t in result.edges} == {"KNOWS": 2, "WORKS_AT": 1}
    run = await session.get(TaskRun, result.run_id)
    assert (run.workflow_key, run.triggered_by) == ("count-types@1", TriggeredBy.canvas.value)


async def test_a_reopened_canvas_is_resolved_by_element_id(session, runtime, graph, user, connector, seeded_graph):
    """The canvas holds element ids — a property named `id` is not what it drew."""
    gone = await connector.data_writer.create_vertex("Person", {"name": "Gone"})
    await connector.data_writer.delete_vertex(gone.id)
    ids = [seeded_graph["alice"].id, gone.id]

    result = await canvas.resolve(session, runtime=runtime, graph=graph, actor_id=user.id, vertex_ids=ids, lens_id=None)

    assert (result.present, result.missing) == ([seeded_graph["alice"].id], [gone.id])
    run = await session.get(TaskRun, result.run_id)
    assert run.triggered_by == TriggeredBy.system.value
