"""REST endpoints for reading graph schema data (read-only in v1).

Endpoints
---------
GET  /api/v1/schemas/{schema_id}/active-version   get active version w/ all type data
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.db import get_session
from invana.modeller.schemas import VersionResponse
from invana.modeller.store import SchemaStore

schemas_router = APIRouter(prefix="/api/v1/schemas", tags=["schemas"])


def _store() -> SchemaStore:
    return SchemaStore()


@schemas_router.get("/{schema_id}/active-version", response_model=VersionResponse)
async def get_active_version(
    schema_id: str,
    session: AsyncSession = Depends(get_session),
) -> VersionResponse:
    """Return the active schema version.

    Falls back to the latest draft if no active version exists yet
    (e.g. immediately after first introspection).
    """
    store = _store()
    version = await store.get_active_version(session, schema_id)

    if version is None:
        # Fall back to the latest version regardless of status
        versions = await store.list_versions(session, schema_id)
        if versions:
            # list_versions orders by created_at asc; take the last one
            latest_id = versions[-1].id
            version = await store.get_version(session, latest_id)

    if version is None:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={"error": "version_not_found", "schema_id": schema_id},
        )
    return VersionResponse.model_validate(version)
