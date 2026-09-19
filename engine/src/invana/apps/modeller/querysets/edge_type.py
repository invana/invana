"""Queries against ``edge_type_definitions``."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from invana.apps.modeller.models import (
    EdgeTypeDefinition,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
from invana.apps.modeller.querysets.base import VersionScopedQuerySet, _mapping_eager


class EdgeTypeQuerySet(VersionScopedQuerySet):
    async def create_edge_type(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        name: str,
        description: str = "",
        source_node_types: list[str] | None = None,
        target_node_types: list[str] | None = None,
        multiplicity: str = "MULTI",
        property_mappings: list[dict] | None = None,
    ) -> EdgeTypeDefinition:
        await self._ensure_draft(session, version_id)

        edge_type = EdgeTypeDefinition(
            version_id=version_id,
            name=name,
            description=description,
            source_node_types=source_node_types or [],
            target_node_types=target_node_types or [],
            multiplicity=multiplicity,
        )
        session.add(edge_type)
        await session.flush()

        if property_mappings:
            for mapping_data in property_mappings:
                await self._create_type_property_mapping(
                    session, version_id=version_id, edge_type_id=edge_type.id, **mapping_data
                )

        # Reload with eager-loaded mappings
        return await self.get_edge_type(session, edge_type.id)

    async def get_edge_type(self, session: AsyncSession, edge_type_id: str) -> EdgeTypeDefinition | None:
        stmt = (
            select(EdgeTypeDefinition)
            .where(EdgeTypeDefinition.id == edge_type_id)
            .options(selectinload(EdgeTypeDefinition.property_mappings).options(*_mapping_eager()))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_edge_types(self, session: AsyncSession, version_id: str) -> list[EdgeTypeDefinition]:
        stmt = (
            select(EdgeTypeDefinition)
            .where(EdgeTypeDefinition.version_id == version_id)
            .options(selectinload(EdgeTypeDefinition.property_mappings).options(*_mapping_eager()))
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def update_edge_type(
        self,
        session: AsyncSession,
        edge_type_id: str,
        **fields: object,
    ) -> EdgeTypeDefinition | None:
        et = await self.get_edge_type(session, edge_type_id)
        if et is None:
            return None
        await self._ensure_draft(session, et.version_id)
        # property_mappings is a relationship — pop it out of the scalar setattr loop
        # and full-replace it (None = leave untouched, [] = remove all properties).
        property_mappings = fields.pop("property_mappings", None)
        for key, value in fields.items():
            if value is not None and hasattr(et, key):
                setattr(et, key, value)
        if property_mappings is not None:
            for mapping in list(et.property_mappings):
                await session.delete(mapping)
            await session.flush()
            for mapping_data in property_mappings:
                await self._create_type_property_mapping(
                    session, version_id=et.version_id, edge_type_id=et.id, **mapping_data
                )
            session.expire(et, ["property_mappings"])  # drop the stale collection so the re-fetch reloads it
        await session.flush()
        return await self.get_edge_type(session, edge_type_id)

    async def delete_edge_type(self, session: AsyncSession, edge_type_id: str) -> bool:
        et = await self.get_edge_type(session, edge_type_id)
        if et is None:
            return False
        await self._ensure_draft(session, et.version_id)
        await session.delete(et)
        await session.flush()
        return True

    # ------------------------------------------------------------------
    # Constraint CRUD
    # ------------------------------------------------------------------
