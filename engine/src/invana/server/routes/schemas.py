"""Schema endpoints — graph-scoped under /u/{username}/{graphSlug}/schema.

Endpoint
--------
GET /api/v1/u/{username}/{graphSlug}/schema/active-version

Resolves to the active version of the GraphConnection's schema. Falls back
to the latest version regardless of status if no active version exists yet.
Needs the Graph's **Connected** gate — a database is attached
(docs/for-developers/modules/platform/features/setup.md §2).
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.managers import GraphManager
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.modeller.schemas import VersionResponse
from invana.apps.modeller.store import ModelStore
from invana.core.db import get_session
from invana.server.graphs.deps import require_graph_connected, require_graph_member

schemas_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/schema", tags=["schemas"])


@schemas_router.get("/active-version", response_model=VersionResponse)
async def get_active_version(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    session: AsyncSession = Depends(get_session),
) -> VersionResponse:
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
    if connection is None or connection.model_id is None:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={"error": "no_schema", "graph_id": graph.id},
        )

    store = ModelStore()
    version = await store.get_active_version(session, connection.model_id)

    if version is None:
        versions = await store.list_versions(session, connection.model_id)
        if versions:
            latest_id = versions[-1].id
            version = await store.get_version(session, latest_id)

    if version is None:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={"error": "version_not_found", "model_id": connection.model_id},
        )
    return VersionResponse.model_validate(version)
