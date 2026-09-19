"""HTTP views for the Explorer.

Parse, call one manager, serialise (migration-plan §4.1). The connector pool is
an app-state dependency, handed to the manager rather than reached for.
"""

from __future__ import annotations

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.explorer.managers import ExploreManager
from invana.apps.explorer.schemas import (
    ExpandByEdgeTypeRequest,
    ExpandByNodeTypeRequest,
    ExpandNeighborsRequest,
    NeighborExpandResponse,
    ResolveElementsRequest,
    ResolveElementsResponse,
    TypeCount,
    TypeCountsResponse,
)
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.pool import GraphConnectionManager
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.server.graphs.deps import require_graph_connected, require_graph_member

explore = ExploreManager()


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


async def expand_neighbors(
    payload: ExpandNeighborsRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> NeighborExpandResponse:
    return await explore.expand_neighbors(session, graph=graph, manager=manager, actor_id=user.id, req=payload)


async def expand_by_edge_type(
    payload: ExpandByEdgeTypeRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> NeighborExpandResponse:
    return await explore.expand_by_edge_type(session, graph=graph, manager=manager, actor_id=user.id, req=payload)


async def expand_by_node_type(
    payload: ExpandByNodeTypeRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> NeighborExpandResponse:
    return await explore.expand_by_node_type(session, graph=graph, manager=manager, actor_id=user.id, req=payload)


async def resolve_elements(
    payload: ResolveElementsRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    manager: GraphConnectionManager = Depends(_get_manager),
    session: AsyncSession = Depends(get_session),
) -> ResolveElementsResponse:
    """Which of a canvas's elements the graph still holds (GC5).

    Read-only, and it emits no event: a canvas asking whether its own drawing is
    still true is not an action anybody audits.
    """
    present, missing = await explore.resolve_elements(
        session, graph=graph, manager=manager, vertex_ids=payload.vertex_ids
    )
    return ResolveElementsResponse(present=present, missing=missing, checked=len(payload.vertex_ids))


async def type_counts(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> TypeCountsResponse:
    """Node and edge types with graph-wide counts — the Explorer panel's legend.

    Read-only and unlogged: it states what the graph holds, which is not a
    traversal anybody took (selection-and-the-panel.md SP6).
    """
    nodes, edges, counted = await explore.type_counts(session, graph=graph, manager=manager)
    return TypeCountsResponse(
        nodes=[TypeCount(name=name, count=count) for name, count in nodes],
        edges=[TypeCount(name=name, count=count) for name, count in edges],
        counted=counted,
    )
