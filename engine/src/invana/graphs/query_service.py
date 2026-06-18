"""Shared query-execution core (RFC-024).

The connector resolution, read-only guard, capability resolution, execution,
and `query.execute` audit emission used to live inline in the `/query` route.
RFC-024 removes that standalone route and makes the **sessions message
endpoint** the only HTTP entry point — so this logic moves here as a reusable
service both could call. ``execute_query`` does NOT commit; the caller owns the
transaction (a session message endpoint commits the messages + the run result
together).

Failure modes:
- **Config / availability problems** (no connection, graph not active,
  unsupported language, read-only violation) raise ``HTTPException`` — these are
  "you can't run this", not "your query failed".
- **The query itself failing** raises ``QueryExecutionError`` after emitting a
  failure ``query.execute`` event. Callers decide how to surface it (the
  session endpoint records it as an in-thread error message).
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.events import actions as event_actions
from invana.events.services import current_trace_id, emit_event
from invana.graph.connectors.base.exceptions import QueryErrorCategory
from invana.graph.types.constants import Capability, QueryLanguage
from invana.graph.types.data_elements import GraphResponse
from invana.graphs.manager import GraphConnectionManager, GraphUnavailableError
from invana.graphs.models import Graph
from invana.graphs.schemas import QueryResponse
from invana.graphs.services import get_graph_connection


class QueryExecutionError(Exception):
    """The connector rejected/failed the query itself (not a config problem).

    ``category`` carries the connector's ``QueryErrorCategory`` classification
    (syntax / timeout / unknown) so callers can pick user-facing copy without
    re-parsing the raw message.
    """

    def __init__(self, message: str, *, category: str = QueryErrorCategory.UNKNOWN) -> None:
        super().__init__(message)
        self.category = category


async def execute_query(
    session: AsyncSession,
    *,
    graph: Graph,
    manager: GraphConnectionManager,
    query: str,
    parameters: dict[str, Any] | None,
    actor_id: str,
    session_id: str | None = None,
    timeout_s: float | None = None,
) -> QueryResponse:
    """Run *query* against *graph*'s live connector and emit the audit event.

    ``timeout_s`` is forwarded to the connector as a per-query budget (seconds);
    ``None`` leaves it unbounded. Does not commit. Raises ``HTTPException`` for
    config/availability problems, ``QueryExecutionError`` if the connector fails
    the query.
    """
    connection, connector = await _resolve_connector(session, graph=graph, manager=manager)
    query_language = _resolve_query_language(connector)

    if connection.read_only:
        _assert_read_only_query(query, query_language)

    base_details: dict[str, Any] = {
        "language": query_language.value,
        "query_length": len(query),
    }
    if session_id is not None:
        base_details["session_id"] = session_id

    try:
        graph_response = await connector.execute(query, parameters=parameters, timeout_s=timeout_s)
    except Exception as exc:
        # Carry the connector's classification through (it's lost once we re-wrap
        # into the service-level error). The raw message + vendor code land in the
        # audit event for review; the user gets backend-owned copy upstream.
        category = getattr(exc, "category", QueryErrorCategory.UNKNOWN)
        await emit_event(
            session,
            action=event_actions.QUERY_EXECUTE,
            target_kind=event_actions.TARGET_QUERY,
            graph_id=graph.id,
            actor_id=actor_id,
            details={
                **base_details,
                "ok": False,
                "error": str(exc),
                "error_code": getattr(exc, "code", None),
                "error_category": category,
            },
            trace_id=current_trace_id(),
        )
        raise QueryExecutionError(str(exc), category=category) from exc

    response = _build_query_response(graph_response, query_language)
    await emit_event(
        session,
        action=event_actions.QUERY_EXECUTE,
        target_kind=event_actions.TARGET_QUERY,
        graph_id=graph.id,
        actor_id=actor_id,
        details={
            **base_details,
            "ok": True,
            "duration_ms": response.execution_time_ms,
            "row_count": response.row_count,
            "result_type": response.result_type,
        },
        trace_id=current_trace_id(),
    )
    return response


# ---------------------------------------------------------------------------
# Helpers (moved verbatim from server/routes/query.py)
# ---------------------------------------------------------------------------

_CYPHER_WRITE_PREFIXES = ("create ", "merge ", "set ", "delete ", "detach delete ", "remove ", "call {")
_GREMLIN_WRITE_FRAGMENTS = (".addv(", ".adde(", ".property(", ".drop(")


def _resolve_query_language(connector) -> QueryLanguage:
    caps = connector.capabilities()
    if Capability.CYPHER in caps:
        return QueryLanguage.CYPHER
    if Capability.GREMLIN in caps:
        return QueryLanguage.GREMLIN
    raise HTTPException(
        status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
        detail={
            "error": "unsupported_query_language",
            "message": "Connector reports neither CYPHER nor GREMLIN capability.",
        },
    )


async def _resolve_connector(session: AsyncSession, *, graph: Graph, manager: GraphConnectionManager):
    """Resolve *graph*'s live connector (registry is keyed by **connection id**).

    Raises ``HTTPException`` for the config/availability cases (no connection /
    not active). Shared by ``execute_query`` and the sessions NL path so they
    can never drift on how the connector is found.
    """
    connection = await get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail={"error": "no_connection", "graph_id": graph.id},
        )
    try:
        connector = manager.get_connector(connection.id)
    except GraphUnavailableError:
        raise HTTPException(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
            detail={"error": "graph_not_active", "connection_id": connection.id},
        ) from None
    return connection, connector


async def resolve_query_language(
    session: AsyncSession, *, graph: Graph, manager: GraphConnectionManager
) -> QueryLanguage:
    """The graph's live query language — used to ground NL translation (RFC-030)."""
    _, connector = await _resolve_connector(session, graph=graph, manager=manager)
    return _resolve_query_language(connector)


def _assert_read_only_query(query: str, query_language: QueryLanguage) -> None:
    normalised = query.strip().lower()

    if query_language == QueryLanguage.CYPHER:
        for prefix in _CYPHER_WRITE_PREFIXES:
            if normalised.startswith(prefix):
                raise HTTPException(
                    status_code=HTTPStatus.FORBIDDEN,
                    detail={
                        "error": "read_only_graph",
                        "message": "Graph is read-only. Write operations are not allowed.",
                    },
                )
    elif query_language == QueryLanguage.GREMLIN:
        for fragment in _GREMLIN_WRITE_FRAGMENTS:
            if fragment in normalised:
                raise HTTPException(
                    status_code=HTTPStatus.FORBIDDEN,
                    detail={
                        "error": "read_only_graph",
                        "message": "Graph is read-only. Write operations are not allowed.",
                    },
                )


def _build_query_response(graph_response: GraphResponse, query_language: QueryLanguage) -> QueryResponse:
    """Map a connector's GraphResponse onto the wire-format QueryResponse.

    Nodes/edges present → graph result (consumed by the canvas).
    Otherwise → tabular result (records consumed by the table view).
    """
    has_graph = bool(graph_response.nodes or graph_response.edges)
    if has_graph:
        return QueryResponse(
            result_type="graph",
            query_language=query_language.value,
            data=graph_response,
            rows=None,
            execution_time_ms=round(graph_response.metadata.duration_ms),
            row_count=len(graph_response.nodes) + len(graph_response.edges),
        )
    return QueryResponse(
        result_type="tabular",
        query_language=query_language.value,
        data=None,
        rows=graph_response.records,
        execution_time_ms=round(graph_response.metadata.duration_ms),
        row_count=len(graph_response.records),
    )
