"""Queries against ``schema_projections``."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from invana.apps.modeller.models import (
    GraphVersion,
    SchemaProjection,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
from invana.apps.modeller.querysets.base import VersionScopedQuerySet


class SchemaProjectionQuerySet(VersionScopedQuerySet):
    async def create_projection(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        connector_id: str,
        status: str = "pending",
        operations: list[dict] | None = None,
        errors: list[dict] | None = None,
        projected_at=None,
    ) -> SchemaProjection:
        proj = SchemaProjection(
            version_id=version_id,
            connector_id=connector_id,
            status=status,
            operations=operations or [],
            errors=errors or [],
            projected_at=projected_at,
        )
        session.add(proj)
        await session.flush()
        return proj

    async def get_latest_projection(
        self, session: AsyncSession, model_id: str, connector_id: str
    ) -> SchemaProjection | None:
        stmt = (
            select(SchemaProjection)
            .join(GraphVersion)
            .where(
                GraphVersion.model_id == model_id,
                SchemaProjection.connector_id == connector_id,
            )
            .order_by(SchemaProjection.projected_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
