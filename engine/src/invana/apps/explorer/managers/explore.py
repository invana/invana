"""Explorer rules — expanding from what is already on the canvas.

Every expansion runs against the live graph database through the connector, and
records itself on the backing session so the canvas has a transcript. The app
owns *what to ask and what it means*; `invana.graph` owns speaking to the
database (migration-plan §2).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.explorer.schemas import (
    ExpandByEdgeTypeRequest,
    ExpandByNodeTypeRequest,
    ExpandNeighborsRequest,
    NeighborExpandResponse,
)
from invana.apps.graphs.models import Graph
from invana.apps.graphs.pool import GraphConnectionManager
from invana.apps.graphs.query_service import _resolve_connector, _resolve_query_language
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.querysets import SessionQuerySet
from invana.core.events import actions as event_actions
from invana.core.events.services import current_trace_id, emit_event
from invana.graph.types.data_elements import GraphResponse


def _expand_summary(nodes: int, edges: int) -> str:
    def plural(n: int, noun: str) -> str:
        return f"{n} {noun}{'' if n == 1 else 's'}"

    return f"Added {plural(nodes, 'node')} and {plural(edges, 'relationship')}."


def _expand_prompt(req: Any, by: dict[str, str]) -> str:
    """Human-readable user-turn text for an expand (docs/for-developers/modules/explore/features/boards.md)."""
    qualifier = ""
    if "edge_label" in by:
        qualifier = f'"{by["edge_label"]}" '
    elif "neighbor_label" in by:
        qualifier = f'"{by["neighbor_label"]}" '
    direction = {"in": " (incoming)", "out": " (outgoing)"}.get(req.direction, "")
    return f'Expand {qualifier}neighbours of "{req.vertex_id}"{direction}'


class ExploreManager:
    sessions = SessionManager()
    sessions_qs = SessionQuerySet()

    async def expand_neighbors(
        self,
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
        return await self._finalize(
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
        self,
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
        return await self._finalize(
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
        self,
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
        return await self._finalize(
            session,
            graph=graph,
            actor_id=actor_id,
            req=req,
            data=data,
            total=total,
            by={"neighbor_label": req.neighbor_label},
            language=_resolve_query_language(connector).value,
        )

    async def _record_expand(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        actor_id: str,
        req: Any,
        data: GraphResponse,
        by: dict[str, str],
        language: str,
    ) -> None:
        """Log the expand as a session turn, when it targets a session
        (docs/for-developers/modules/explore/features/boards.md).

        Best-effort: an unknown/foreign ``session_id`` is skipped rather than fatal,
        so a bad id never breaks the expand itself. Runs in the route's transaction,
        so it commits atomically with the expand.
        """
        session_id = getattr(req, "session_id", None)
        if not session_id:
            return
        sess = await self.sessions_qs.get(session, session_id)
        if sess is None or sess.graph_id != graph.id or sess.created_by_id != actor_id:
            return
        nodes = len(data.nodes)
        edges = len(data.edges)
        # Nothing came back (e.g. paging past the end) — don't log an empty turn.
        if nodes == 0 and edges == 0:
            return
        await self.sessions.record_operation(
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
        self,
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
        await self._record_expand(session, graph=graph, actor_id=actor_id, req=req, data=data, by=by, language=language)
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

    async def resolve_elements(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        manager: GraphConnectionManager,
        vertex_ids: list[str],
    ) -> tuple[list[str], list[str]]:
        """Split *vertex_ids* into the ones the graph still holds and the ones it does not.

        One query for the whole canvas rather than one per node: a reopened canvas
        asks this once, on hydrate, and marking a hundred elements should not cost a
        hundred round trips.
        """
        if not vertex_ids:
            return [], []
        _, connector = await _resolve_connector(session, graph=graph, manager=manager)
        result = await connector.execute(
            "MATCH (n) WHERE n.id IN $ids RETURN collect(DISTINCT n.id) AS present",
            parameters={"ids": vertex_ids},
        )
        rows = getattr(result, "records", None) or getattr(result, "rows", None) or []
        present = set()
        for row in rows:
            values = row.get("present") if isinstance(row, dict) else None
            if values:
                present.update(str(v) for v in values)
        ordered_present = [vid for vid in vertex_ids if vid in present]
        missing = [vid for vid in vertex_ids if vid not in present]
        return ordered_present, missing

    async def type_counts(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        manager: GraphConnectionManager,
    ) -> tuple[list[tuple[str, int | None]], list[tuple[str, int | None]], bool]:
        """Every node and edge type in the graph, with counts where the vendor has them.

        Two calls, not one per label: counting 40 labels one at a time is 40 round
        trips for a panel that opens with the page. A vendor that cannot count
        returns ``None`` from the reader, and the labels come back with no numbers
        rather than the panel coming back empty (selection-and-the-panel.md SP8).
        """
        _, connector = await _resolve_connector(session, graph=graph, manager=manager)
        reader = connector.schema_reader

        node_counts = await reader.get_node_label_counts()
        edge_counts = await reader.get_edge_label_counts()
        counted = node_counts is not None or edge_counts is not None

        if node_counts is None or edge_counts is None:
            # Fall back to the label lists so the panel still names every type.
            node_labels = await reader.get_node_labels()
            edge_labels = await reader.get_edge_labels()
            nodes = [(label, None if node_counts is None else node_counts.get(label, 0)) for label in node_labels]
            edges = [(label, None if edge_counts is None else edge_counts.get(label, 0)) for label in edge_labels]
        else:
            nodes = [(label, int(count)) for label, count in node_counts.items()]
            edges = [(label, int(count)) for label, count in edge_counts.items()]

        # Biggest first — the types that dominate the graph read first. Unknown
        # counts keep the vendor's own order.
        nodes.sort(key=lambda row: (row[1] is None, -(row[1] or 0), row[0]))
        edges.sort(key=lambda row: (row[1] is None, -(row[1] or 0), row[0]))
        return nodes, edges, counted
