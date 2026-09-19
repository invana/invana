"""Queries against ``index_definitions``."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from invana.apps.modeller.models import (
    IndexDefinition,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
from invana.apps.modeller.querysets.base import VersionScopedQuerySet


class IndexQuerySet(VersionScopedQuerySet):
    async def create_index(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        name: str,
        target_kind: str,
        target_label: str,
        properties: list[str],
        index_type: str = "range",
        index_options: dict | None = None,
    ) -> IndexDefinition:
        await self._ensure_draft(session, version_id)
        idx = IndexDefinition(
            version_id=version_id,
            name=name,
            target_kind=target_kind,
            target_label=target_label,
            properties=properties,
            index_type=index_type,
            index_options=index_options,
        )
        session.add(idx)
        await session.flush()
        return idx

    async def get_index(self, session: AsyncSession, index_id: str) -> IndexDefinition | None:
        stmt = select(IndexDefinition).where(IndexDefinition.id == index_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_indexes(self, session: AsyncSession, version_id: str) -> list[IndexDefinition]:
        stmt = select(IndexDefinition).where(IndexDefinition.version_id == version_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def delete_index(self, session: AsyncSession, index_id: str) -> bool:
        idx = await self.get_index(session, index_id)
        if idx is None:
            return False
        await self._ensure_draft(session, idx.version_id)
        await session.delete(idx)
        await session.flush()
        return True

    # ------------------------------------------------------------------
    # Projection record
    # ------------------------------------------------------------------
