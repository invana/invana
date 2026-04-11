"""Raw query execution endpoint.

Endpoint
--------
POST /api/v1/graphs/{id}/query
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.db import get_session
from invana.graph.types.constants import Capability, QueryLanguage
from invana.graphs.manager import GraphConnectionManager, GraphUnavailableError
from invana.graphs.schemas import QueryRequest, QueryResponse
from invana.graphs.store import GraphModelStore

query_router = APIRouter(prefix="/api/v1/graphs", tags=["query"])


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


def _resolve_query_language(connector) -> QueryLanguage:
    """Determine the query language from the connector's capabilities.

    Prefers Cypher when both are advertised (e.g. ArcadeDB supports both).
    Raises 422 if neither is supported.
    """
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


@query_router.post("/{graph_id}/query", response_model=QueryResponse)
async def run_query(
    graph_id: str,
    body: QueryRequest,
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> QueryResponse:
    """Execute a raw Cypher or Gremlin query against the specified graph.

    The query language is inferred from the connector's reported capabilities.
    Read-only graphs have write operations rejected before execution.
    """
    graph = await GraphModelStore().get_or_404(session, graph_id)

    try:
        connector = manager.get_connector(graph_id)
    except GraphUnavailableError:
        raise HTTPException(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
            detail={"error": "graph_not_active", "graph_id": graph_id},
        ) from None

    query_language = _resolve_query_language(connector)

    if graph.read_only:
        _assert_read_only_query(body.query, query_language)

    try:
        raw_result = await connector.execute(
            body.query,
            parameters=body.parameters,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail={"error": "query_execution_failed", "message": str(exc)},
        ) from exc

    result_list = raw_result if isinstance(raw_result, list) else ([raw_result] if raw_result is not None else [])

    return QueryResponse(
        result_type=_detect_result_type(result_list),
        query_language=query_language.value,
        data=result_list,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CYPHER_WRITE_PREFIXES = ("create ", "merge ", "set ", "delete ", "detach delete ", "remove ", "call {")
_GREMLIN_WRITE_FRAGMENTS = (".addv(", ".adde(", ".property(", ".drop(")


def _assert_read_only_query(query: str, query_language: QueryLanguage) -> None:
    """Raise 403 if the query looks like a write operation on a read-only graph."""
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


def _detect_result_type(result: list) -> str:
    """Infer whether the result represents graph data or tabular data."""
    if not result:
        return "tabular"
    first = result[0]
    if isinstance(first, dict) and "id" in first and ("label" in first or "type" in first):
        return "graph"
    return "tabular"
