"""Explorer node-expand service (RFC-035).

Resolves the graph's live connector and calls the focused ``data_reader``
traversal methods (read + count), then emits a ``graph.expand`` audit event.
Read-only by construction (no string write-guard needed). Does not commit —
the route owns the transaction (mirrors ``query_service.execute_query``).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.events import actions as event_actions
from invana.events.services import current_trace_id, emit_event
from invana.explorer.schemas import (
    ExpandByEdgeTypeRequest,
    ExpandByNodeTypeRequest,
    ExpandNeighborsRequest,
    NeighborExpandResponse,
)
from invana.graph.types.data_elements import GraphResponse
from invana.graphs.manager import GraphConnectionManager
from invana.graphs.models import Graph
from invana.graphs.query_service import _resolve_connector


async def expand_neighbors(
    session: AsyncSession,
    *,
    graph: Graph,
    manager: GraphConnectionManager,
    actor_id: str,
    req: ExpandNeighborsRequest,
) -> NeighborExpandResponse:
    """Expand all neighbours of ``req.vertex_id``."""
    _, connector = await _resolve_connector(session, graph=graph, manager=manager)
    reader = connector.data_reader
    data = await reader.read_neighbors(
        req.vertex_id,
        direction=req.direction,
        filters=req.filters,
        sort=req.sort,
        limit=req.limit,
        offset=req.offset,
    )
    total = await reader.count_neighbors(req.vertex_id, direction=req.direction, filters=req.filters)
    return await _finalize(session, graph=graph, actor_id=actor_id, req=req, data=data, total=total, by={})


async def expand_by_edge_type(
    session: AsyncSession,
    *,
    graph: Graph,
    manager: GraphConnectionManager,
    actor_id: str,
    req: ExpandByEdgeTypeRequest,
) -> NeighborExpandResponse:
    """Expand neighbours reached via ``req.edge_label``."""
    _, connector = await _resolve_connector(session, graph=graph, manager=manager)
    reader = connector.data_reader
    data = await reader.read_neighbors_by_edge_type(
        req.vertex_id,
        edge_label=req.edge_label,
        direction=req.direction,
        filters=req.filters,
        sort=req.sort,
        limit=req.limit,
        offset=req.offset,
    )
    total = await reader.count_neighbors_by_edge_type(
        req.vertex_id, edge_label=req.edge_label, direction=req.direction, filters=req.filters
    )
    return await _finalize(
        session,
        graph=graph,
        actor_id=actor_id,
        req=req,
        data=data,
        total=total,
        by={"edge_label": req.edge_label},
    )


async def expand_by_node_type(
    session: AsyncSession,
    *,
    graph: Graph,
    manager: GraphConnectionManager,
    actor_id: str,
    req: ExpandByNodeTypeRequest,
) -> NeighborExpandResponse:
    """Expand neighbours of node type ``req.neighbor_label``."""
    _, connector = await _resolve_connector(session, graph=graph, manager=manager)
    reader = connector.data_reader
    data = await reader.read_neighbors_by_node_type(
        req.vertex_id,
        neighbor_label=req.neighbor_label,
        direction=req.direction,
        filters=req.filters,
        sort=req.sort,
        limit=req.limit,
        offset=req.offset,
    )
    total = await reader.count_neighbors_by_node_type(
        req.vertex_id, neighbor_label=req.neighbor_label, direction=req.direction, filters=req.filters
    )
    return await _finalize(
        session,
        graph=graph,
        actor_id=actor_id,
        req=req,
        data=data,
        total=total,
        by={"neighbor_label": req.neighbor_label},
    )


async def _finalize(
    session: AsyncSession,
    *,
    graph: Graph,
    actor_id: str,
    req: Any,
    data: GraphResponse,
    total: int,
    by: dict[str, str],
) -> NeighborExpandResponse:
    """Build the paginated response + emit the audit event (no commit)."""
    returned = len(data.edges)
    has_more = req.offset + returned < total
    await emit_event(
        session,
        action=event_actions.GRAPH_EXPAND,
        target_kind=event_actions.TARGET_QUERY,
        graph_id=graph.id,
        actor_id=actor_id,
        details={
            "vertex_id": req.vertex_id,
            "direction": req.direction,
            **by,
            "limit": req.limit,
            "offset": req.offset,
            "returned": returned,
            "total": total,
            "has_more": has_more,
        },
        trace_id=current_trace_id(),
    )
    return NeighborExpandResponse(
        data=data,
        total=total,
        offset=req.offset,
        limit=req.limit,
        returned=returned,
        has_more=has_more,
    )
