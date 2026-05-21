"""Back-compat shim for the pre-S2 /api/v1/graphs/{connection_id}/query route.

Will be removed once the Studio's modeller + explorer pages are re-mounted
under /u/:username/:slug/* (S2 Task #10) and switch to the graph-scoped query
endpoint at /api/v1/u/{username}/{slug}/query.
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.db import get_session
from invana.graph.types.constants import Capability, QueryLanguage
from invana.graphs.manager import GraphConnectionManager, GraphUnavailableError
from invana.graphs.schemas import QueryRequest, QueryResponse
from invana.graphs.store import GraphConnectionStore

legacy_query_router = APIRouter(prefix="/api/v1/graphs", tags=["query-legacy"])


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


@legacy_query_router.post("/{connection_id}/query", response_model=QueryResponse)
async def run_query_by_connection_id(
    connection_id: str,
    body: QueryRequest,
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> QueryResponse:
    connection = await GraphConnectionStore().get_or_404(session, connection_id)

    try:
        connector = manager.get_connector(connection_id)
    except GraphUnavailableError:
        raise HTTPException(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
            detail={"error": "graph_not_active", "connection_id": connection_id},
        ) from None

    caps = connector.capabilities()
    if Capability.CYPHER in caps:
        language = QueryLanguage.CYPHER
    elif Capability.GREMLIN in caps:
        language = QueryLanguage.GREMLIN
    else:
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail={"error": "unsupported_query_language"},
        )

    if connection.read_only:
        from invana.server.routes.query import _assert_read_only_query  # noqa: PLC0415

        _assert_read_only_query(body.query, language)

    try:
        raw_result = await connector.execute(body.query, parameters=body.parameters)
    except Exception as exc:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail={"error": "query_execution_failed", "message": str(exc)},
        ) from exc

    from invana.server.routes.query import _detect_result_type  # noqa: PLC0415

    result_list = raw_result if isinstance(raw_result, list) else ([raw_result] if raw_result is not None else [])

    return QueryResponse(
        result_type=_detect_result_type(result_list),
        query_language=language.value,
        data=result_list,
    )
