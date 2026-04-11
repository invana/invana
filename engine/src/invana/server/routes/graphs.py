"""REST endpoints for managing Graph connection records.

Endpoints
---------
POST   /api/v1/graphs                      create
GET    /api/v1/graphs                      list
GET    /api/v1/graphs/{id}                 get
PATCH  /api/v1/graphs/{id}                 update
DELETE /api/v1/graphs/{id}                 soft-delete

POST   /api/v1/graphs/{id}/reconnect       force re-connect
POST   /api/v1/graphs/{id}/introspect      re-run schema introspection
POST   /api/v1/graphs/{id}/project         apply schema to the graph DB
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.db import get_session
from invana.graphs.manager import GraphConnectionManager, GraphUnavailableError
from invana.graphs.schemas import GraphCreate, GraphListResponse, GraphRead, GraphUpdate
from invana.graphs.store import GraphModelStore
from invana.settings import settings

graphs_router = APIRouter(prefix="/api/v1/graphs", tags=["graphs"])


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


def _store() -> GraphModelStore:
    return GraphModelStore()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@graphs_router.post("", status_code=HTTPStatus.CREATED, response_model=GraphRead)
async def create_graph(
    body: GraphCreate,
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> GraphRead:
    """Create a new graph connection record and initiate connection."""
    store = _store()
    graph = await store.create(session, data=body, encryption_key=settings.encryption_key)
    await session.commit()
    await session.refresh(graph)

    # Fire-and-forget — connection happens in background
    await manager.register(graph)

    return GraphRead.model_validate(graph)


@graphs_router.get("", response_model=GraphListResponse)
async def list_graphs(
    session: AsyncSession = Depends(get_session),
) -> GraphListResponse:
    """Return all graph records (including INACTIVE)."""
    graphs = await _store().list_all(session)
    return GraphListResponse(
        items=[GraphRead.model_validate(g) for g in graphs],
        total=len(graphs),
    )


@graphs_router.get("/{graph_id}", response_model=GraphRead)
async def get_graph(
    graph_id: str,
    session: AsyncSession = Depends(get_session),
) -> GraphRead:
    """Return a single graph record."""
    graph = await _store().get_or_404(session, graph_id)
    return GraphRead.model_validate(graph)


@graphs_router.patch("/{graph_id}", response_model=GraphRead)
async def update_graph(
    graph_id: str,
    body: GraphUpdate,
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> GraphRead:
    """Update graph metadata or connection details.

    If ``uri`` or ``auth`` changes the manager will reconnect automatically.
    """
    store = _store()
    graph = await store.update(session, graph_id, data=body, encryption_key=settings.encryption_key)
    await session.commit()
    await session.refresh(graph)

    uri_or_auth_changed = body.uri is not None or body.auth is not None
    if uri_or_auth_changed:
        await manager.reconnect(graph)

    return GraphRead.model_validate(graph)


@graphs_router.delete("/{graph_id}", status_code=HTTPStatus.NO_CONTENT)
async def delete_graph(
    graph_id: str,
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> None:
    """Soft-delete the graph and deregister its live connector."""
    await _store().soft_delete(session, graph_id)
    await session.commit()
    await manager.deregister(graph_id)


# ---------------------------------------------------------------------------
# Connection management
# ---------------------------------------------------------------------------


@graphs_router.post("/{graph_id}/reconnect", status_code=HTTPStatus.ACCEPTED)
async def reconnect_graph(
    graph_id: str,
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> dict:
    """Force a reconnect using the current stored credentials."""
    graph = await _store().get_or_404(session, graph_id)
    await manager.reconnect(graph)
    return {"detail": "reconnect initiated"}


@graphs_router.post("/{graph_id}/introspect", status_code=HTTPStatus.ACCEPTED)
async def introspect_graph(
    graph_id: str,
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> dict:
    """Re-run schema introspection against the live graph database."""
    store = _store()
    graph = await store.get_or_404(session, graph_id)

    try:
        connector = manager.get_connector(graph_id)
    except GraphUnavailableError:
        raise HTTPException(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
            detail={"error": "graph_not_active", "graph_id": graph_id},
        ) from None

    import asyncio  # noqa: PLC0415

    asyncio.create_task(manager._auto_introspect(session, graph, connector))  # type: ignore[attr-defined]
    return {"detail": "introspection initiated"}


@graphs_router.post("/{graph_id}/project", status_code=HTTPStatus.ACCEPTED)
async def project_graph(
    graph_id: str,
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> dict:
    """Apply the active schema version to the graph database.

    Projection (index/constraint creation) is handled by each connector's
    projector — this endpoint triggers it asynchronously.
    """
    store = _store()
    graph = await store.get_or_404(session, graph_id)

    try:
        manager.get_connector(graph_id)
    except GraphUnavailableError:
        raise HTTPException(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
            detail={"error": "graph_not_active", "graph_id": graph_id},
        ) from None

    if graph.schema_id is None:
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail={"error": "no_schema", "message": "Run /introspect first to seed a schema."},
        )

    return {"detail": "projection initiated", "schema_id": graph.schema_id}
