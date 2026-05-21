"""Schema endpoints — graph-scoped under /u/{username}/{graphSlug}/schema.

Endpoint
--------
GET /api/v1/u/{username}/{graphSlug}/schema/active-version

Resolves to the active version of the GraphConnection's schema. Falls back
to the latest version regardless of status if no active version exists yet.
Graph must have completed the setup wizard's required sections.
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.db import get_session
from invana.graphs import services
from invana.graphs.deps import require_graph_member, require_graph_setup_complete
from invana.graphs.models import Graph, GraphMember
from invana.modeller.schemas import VersionResponse
from invana.modeller.store import SchemaStore

schemas_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/schema", tags=["schemas"])


@schemas_router.get("/active-version", response_model=VersionResponse)
async def get_active_version(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    session: AsyncSession = Depends(get_session),
) -> VersionResponse:
    connection = await services.get_graph_connection(session, graph_id=graph.id)
    if connection is None or connection.schema_id is None:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={"error": "no_schema", "graph_id": graph.id},
        )

    store = SchemaStore()
    version = await store.get_active_version(session, connection.schema_id)

    if version is None:
        versions = await store.list_versions(session, connection.schema_id)
        if versions:
            latest_id = versions[-1].id
            version = await store.get_version(session, latest_id)

    if version is None:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={"error": "version_not_found", "schema_id": connection.schema_id},
        )
    return VersionResponse.model_validate(version)
