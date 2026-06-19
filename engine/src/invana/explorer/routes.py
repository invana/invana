"""HTTP routes for Explorer node-expand / graph traversal (RFC-035).

Three focused, individually-triggerable read-only endpoints under the graph
prefix. Each maps to a focused connector ``data_reader`` method and returns the
neighbour slice plus a total for "showing X of N" pagination. Deps mirror the
sessions message endpoint: graph membership + completed setup.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.db import get_session
from invana.explorer import services
from invana.explorer.schemas import (
    ExpandByEdgeTypeRequest,
    ExpandByNodeTypeRequest,
    ExpandNeighborsRequest,
    NeighborExpandResponse,
)
from invana.graphs.deps import require_graph_member, require_graph_setup_complete
from invana.graphs.manager import GraphConnectionManager
from invana.graphs.models import Graph, GraphMember

explorer_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/explorer",
    tags=["explorer"],
)


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


@explorer_router.post("/expand/neighbors", response_model=NeighborExpandResponse)
async def expand_neighbors(
    payload: ExpandNeighborsRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> NeighborExpandResponse:
    result = await services.expand_neighbors(session, graph=graph, manager=manager, actor_id=user.id, req=payload)
    await session.commit()
    return result


@explorer_router.post("/expand/by-edge-type", response_model=NeighborExpandResponse)
async def expand_by_edge_type(
    payload: ExpandByEdgeTypeRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> NeighborExpandResponse:
    result = await services.expand_by_edge_type(session, graph=graph, manager=manager, actor_id=user.id, req=payload)
    await session.commit()
    return result


@explorer_router.post("/expand/by-node-type", response_model=NeighborExpandResponse)
async def expand_by_node_type(
    payload: ExpandByNodeTypeRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> NeighborExpandResponse:
    result = await services.expand_by_node_type(session, graph=graph, manager=manager, actor_id=user.id, req=payload)
    await session.commit()
    return result
