"""Raw query execution endpoint — graph-scoped under /u/{username}/{graphSlug}.

Endpoint
--------
POST /api/v1/u/{username}/{graphSlug}/query

The query language is inferred from the connector's reported capabilities.
Read-only connections have write operations rejected before execution.
Graph must have completed the setup wizard's required sections.
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.db import get_session
from invana.events import actions as event_actions
from invana.events.services import current_trace_id, emit_event
from invana.graph.types.constants import Capability, QueryLanguage
from invana.graph.types.data_elements import GraphResponse
from invana.graphs import services
from invana.graphs.deps import require_graph_member, require_graph_setup_complete
from invana.graphs.manager import GraphConnectionManager, GraphUnavailableError
from invana.graphs.models import Graph, GraphMember
from invana.graphs.schemas import QueryRequest, QueryResponse

query_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["query"])


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


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


@query_router.post("/query", response_model=QueryResponse)
async def run_query(
    body: QueryRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> QueryResponse:
    connection = await services.get_graph_connection(session, graph_id=graph.id)
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

    query_language = _resolve_query_language(connector)

    if connection.read_only:
        _assert_read_only_query(body.query, query_language)

    try:
        graph_response = await connector.execute(body.query, parameters=body.parameters)
    except Exception as exc:
        await emit_event(
            session,
            action=event_actions.QUERY_EXECUTE,
            target_kind=event_actions.TARGET_QUERY,
            graph_id=graph.id,
            actor_id=user.id,
            details={
                "language": query_language.value,
                "ok": False,
                "error": str(exc),
                "query_length": len(body.query),
            },
            trace_id=current_trace_id(),
        )
        await session.commit()
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail={"error": "query_execution_failed", "message": str(exc)},
        ) from exc

    response = _build_query_response(graph_response, query_language)
    await emit_event(
        session,
        action=event_actions.QUERY_EXECUTE,
        target_kind=event_actions.TARGET_QUERY,
        graph_id=graph.id,
        actor_id=user.id,
        details={
            "language": query_language.value,
            "ok": True,
            "duration_ms": response.execution_time_ms,
            "row_count": response.row_count,
            "result_type": response.result_type,
            "query_length": len(body.query),
        },
        trace_id=current_trace_id(),
    )
    await session.commit()
    return response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CYPHER_WRITE_PREFIXES = ("create ", "merge ", "set ", "delete ", "detach delete ", "remove ", "call {")
_GREMLIN_WRITE_FRAGMENTS = (".addv(", ".adde(", ".property(", ".drop(")


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
            execution_time_ms=int(round(graph_response.metadata.duration_ms)),
            row_count=len(graph_response.nodes) + len(graph_response.edges),
        )
    return QueryResponse(
        result_type="tabular",
        query_language=query_language.value,
        data=None,
        rows=graph_response.records,
        execution_time_ms=int(round(graph_response.metadata.duration_ms)),
        row_count=len(graph_response.records),
    )
