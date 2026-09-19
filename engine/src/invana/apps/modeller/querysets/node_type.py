"""Queries against ``node_type_definitions``."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from invana.apps.modeller.models import (
    NodeTypeDefinition,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
from invana.apps.modeller.querysets.base import VersionScopedQuerySet, _mapping_eager


class NodeTypeQuerySet(VersionScopedQuerySet):
    async def create_node_type(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        name: str,
        description: str = "",
        parent_type: str | None = None,
        is_abstract: bool = False,
        validation_mode: str | None = None,
        property_mappings: list[dict] | None = None,
    ) -> NodeTypeDefinition:
        await self._ensure_draft(session, version_id)

        node_type = NodeTypeDefinition(
            version_id=version_id,
            name=name,
            description=description,
            parent_type=parent_type,
            is_abstract=is_abstract,
            validation_mode=validation_mode,
        )
        session.add(node_type)
        await session.flush()

        if property_mappings:
            for mapping_data in property_mappings:
                await self._create_type_property_mapping(
                    session, version_id=version_id, node_type_id=node_type.id, **mapping_data
                )

        # Reload with eager-loaded mappings
        return await self.get_node_type(session, node_type.id)

    async def get_node_type(self, session: AsyncSession, node_type_id: str) -> NodeTypeDefinition | None:
        stmt = (
            select(NodeTypeDefinition)
            .where(NodeTypeDefinition.id == node_type_id)
            .options(selectinload(NodeTypeDefinition.property_mappings).options(*_mapping_eager()))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_node_types(self, session: AsyncSession, version_id: str) -> list[NodeTypeDefinition]:
        stmt = (
            select(NodeTypeDefinition)
            .where(NodeTypeDefinition.version_id == version_id)
            .options(selectinload(NodeTypeDefinition.property_mappings).options(*_mapping_eager()))
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def update_node_type(
        self,
        session: AsyncSession,
        node_type_id: str,
        **fields: object,
    ) -> NodeTypeDefinition | None:
        nt = await self.get_node_type(session, node_type_id)
        if nt is None:
            return None
        await self._ensure_draft(session, nt.version_id)
        # property_mappings is a relationship — pop it out of the scalar setattr loop
        # and full-replace it (None = leave untouched, [] = remove all properties).
        property_mappings = fields.pop("property_mappings", None)
        for key, value in fields.items():
            if value is not None and hasattr(nt, key):
                setattr(nt, key, value)
        if property_mappings is not None:
            for mapping in list(nt.property_mappings):
                await session.delete(mapping)
            await session.flush()
            for mapping_data in property_mappings:
                await self._create_type_property_mapping(
                    session, version_id=nt.version_id, node_type_id=nt.id, **mapping_data
                )
            session.expire(nt, ["property_mappings"])  # drop the stale collection so the re-fetch reloads it
        await session.flush()
        return await self.get_node_type(session, node_type_id)

    async def delete_node_type(self, session: AsyncSession, node_type_id: str) -> bool:
        nt = await self.get_node_type(session, node_type_id)
        if nt is None:
            return False
        await self._ensure_draft(session, nt.version_id)
        await session.delete(nt)
        await session.flush()
        return True

    # ------------------------------------------------------------------
    # Edge Type CRUD
    # ------------------------------------------------------------------
