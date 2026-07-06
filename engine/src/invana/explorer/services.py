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
from invana.graphs.query_service import _resolve_connector, _resolve_query_language
from invana.sessions import services as session_services
from invana.sessions.store import SessionStore


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
    return await _finalize(
        session,
        graph=graph,
        actor_id=actor_id,
        req=req,
        data=data,
        total=total,
        by={},
        language=_resolve_query_language(connector).value,
    )


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
        language=_resolve_query_language(connector).value,
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
        language=_resolve_query_language(connector).value,
    )


def _expand_summary(nodes: int, edges: int) -> str:
    def plural(n: int, noun: str) -> str:
        return f"{n} {noun}{'' if n == 1 else 's'}"

    return f"Added {plural(nodes, 'node')} and {plural(edges, 'relationship')}."


def _expand_prompt(req: Any, by: dict[str, str]) -> str:
    """Human-readable user-turn text for an expand (RFC-046)."""
    qualifier = ""
    if "edge_label" in by:
        qualifier = f'"{by["edge_label"]}" '
    elif "neighbor_label" in by:
        qualifier = f'"{by["neighbor_label"]}" '
    direction = {"in": " (incoming)", "out": " (outgoing)"}.get(req.direction, "")
    return f'Expand {qualifier}neighbours of "{req.vertex_id}"{direction}'


async def _record_expand(
    session: AsyncSession,
    *,
    graph: Graph,
    actor_id: str,
    req: Any,
    data: GraphResponse,
    by: dict[str, str],
    language: str,
) -> None:
    """Log the expand as a session turn (RFC-046), when it targets a session.

    Best-effort: an unknown/foreign ``session_id`` is skipped rather than fatal,
    so a bad id never breaks the expand itself. Runs in the route's transaction,
    so it commits atomically with the expand.
    """
    session_id = getattr(req, "session_id", None)
    if not session_id:
        return
    sess = await SessionStore().get(session, session_id)
    if sess is None or sess.graph_id != graph.id or sess.created_by_id != actor_id:
        return
    nodes = len(data.nodes)
    edges = len(data.edges)
    # Nothing came back (e.g. paging past the end) — don't log an empty turn.
    if nodes == 0 and edges == 0:
        return
    await session_services.record_operation(
        session,
        sess=sess,
        kind="expand",
        user_content=_expand_prompt(req, by),
        summary=_expand_summary(nodes, edges),
        source_query=data.metadata.query,
        query_language=language,
        row_count=data.metadata.record_count or None,
        execution_time_ms=round(data.metadata.duration_ms) or None,
        node_count=nodes,
        edge_count=edges,
        add_to_totals=True,
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
    language: str,
) -> NeighborExpandResponse:
    """Build the paginated response + emit the audit event + log the session turn
    (no commit — the route owns the transaction)."""
    returned = len(data.edges)
    has_more = req.offset + returned < total
    await _record_expand(session, graph=graph, actor_id=actor_id, req=req, data=data, by=by, language=language)
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
