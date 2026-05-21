"""Back-compat shim for the pre-S2 /api/v1/schemas/{schema_id}/active-version route.

Will be removed once the Studio's modeller page is re-mounted under
/u/:username/:slug/modeller (S2 Task #10) and switches to the graph-scoped
schema endpoint at /api/v1/u/{username}/{slug}/schema/active-version.
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.db import get_session
from invana.modeller.schemas import VersionResponse
from invana.modeller.store import SchemaStore

legacy_schemas_router = APIRouter(prefix="/api/v1/schemas", tags=["schemas-legacy"])


@legacy_schemas_router.get("/{schema_id}/active-version", response_model=VersionResponse)
async def get_active_version_by_id(
    schema_id: str,
    session: AsyncSession = Depends(get_session),
) -> VersionResponse:
    store = SchemaStore()
    version = await store.get_active_version(session, schema_id)
    if version is None:
        versions = await store.list_versions(session, schema_id)
        if versions:
            version = await store.get_version(session, versions[-1].id)
    if version is None:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={"error": "version_not_found", "schema_id": schema_id},
        )
    return VersionResponse.model_validate(version)
