"""Service-layer tests for Explorer node-expand (RFC-035) against a real Neo4j."""

from __future__ import annotations

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from invana.events import actions as event_actions
from invana.events.models import Event
from invana.explorer import services
from invana.explorer.schemas import (
    ExpandByEdgeTypeRequest,
    ExpandByNodeTypeRequest,
    ExpandNeighborsRequest,
)
from invana.graph.types.sort import SortDirection, SortSpec

pytestmark = pytest.mark.asyncio


async def test_expand_neighbors_total_and_has_more(session, graph, manager, user, seeded_graph):
    alice = seeded_graph["alice"]
    req = ExpandNeighborsRequest(vertex_id=alice.id, limit=2, offset=0)
    result = await services.expand_neighbors(session, graph=graph, manager=manager, actor_id=user.id, req=req)
    assert result.total == 3  # Bob, Charlie, Acme
    assert result.returned == 2
    assert result.has_more is True


async def test_expand_by_node_type(session, graph, manager, user, seeded_graph):
    alice = seeded_graph["alice"]
    req = ExpandByNodeTypeRequest(vertex_id=alice.id, neighbor_label="Company")
    result = await services.expand_by_node_type(session, graph=graph, manager=manager, actor_id=user.id, req=req)
    assert result.total == 1
    assert result.returned == 1
    assert result.has_more is False
    labels = {n.label for n in result.data.nodes if n.id != alice.id}
    assert labels == {"Company"}


async def test_expand_by_edge_type_paginated_and_event(session, graph, manager, user, seeded_graph):
    alice = seeded_graph["alice"]
    sort = [SortSpec(property="name", direction=SortDirection.ASC)]
    page1 = ExpandByEdgeTypeRequest(vertex_id=alice.id, edge_label="KNOWS", sort=sort, limit=1, offset=0)
    r1 = await services.expand_by_edge_type(session, graph=graph, manager=manager, actor_id=user.id, req=page1)
    assert r1.total == 2
    assert r1.has_more is True
    page2 = ExpandByEdgeTypeRequest(vertex_id=alice.id, edge_label="KNOWS", sort=sort, limit=1, offset=1)
    r2 = await services.expand_by_edge_type(session, graph=graph, manager=manager, actor_id=user.id, req=page2)
    assert r2.has_more is False
    n1 = [n.properties["name"] for n in r1.data.nodes if n.id != alice.id]
    n2 = [n.properties["name"] for n in r2.data.nodes if n.id != alice.id]
    assert n1 == ["Bob"]
    assert n2 == ["Charlie"]

    # A graph.expand audit event was emitted per call.
    count = (
        await session.execute(select(func.count()).select_from(Event).where(Event.action == event_actions.GRAPH_EXPAND))
    ).scalar_one()
    assert count == 2


async def test_limit_over_max_rejected():
    with pytest.raises(ValidationError):
        ExpandNeighborsRequest(vertex_id="v1", limit=501)


async def test_edge_type_requires_label():
    with pytest.raises(ValidationError):
        ExpandByEdgeTypeRequest(vertex_id="v1", edge_label="")
