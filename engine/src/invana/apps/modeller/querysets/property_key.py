"""Queries against ``property_key_definitions``."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from invana.apps.modeller.models import (
    PropertyKeyDefinition,
    ValidationRule,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
from invana.apps.modeller.querysets.base import VersionScopedQuerySet


class PropertyKeyQuerySet(VersionScopedQuerySet):
    async def create_property_key(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        name: str,
        type: str = "string",
        value_cardinality: str = "SINGLE",
        description: str = "",
        validation_rules: list[dict] | None = None,
    ) -> PropertyKeyDefinition:
        await self._ensure_draft(session, version_id)
        pk = PropertyKeyDefinition(
            version_id=version_id,
            name=name,
            type=type,
            value_cardinality=value_cardinality,
            description=description,
        )
        session.add(pk)
        await session.flush()

        if validation_rules:
            for rule_data in validation_rules:
                rule = ValidationRule(
                    property_key_id=pk.id,
                    rule_type=rule_data["rule_type"],
                    params=rule_data.get("params", {}),
                )
                session.add(rule)
            await session.flush()

        # Reload with eager-loaded validation_rules so the route can serialise the
        # response after commit without triggering an async lazy-load (the relationship
        # is otherwise unloaded for a freshly-created key — MissingGreenlet).
        return await self.get_property_key(session, pk.id)

    async def get_property_key(self, session: AsyncSession, pk_id: str) -> PropertyKeyDefinition | None:
        stmt = (
            select(PropertyKeyDefinition)
            .where(PropertyKeyDefinition.id == pk_id)
            .options(selectinload(PropertyKeyDefinition.validation_rules))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_property_key_by_name(
        self, session: AsyncSession, version_id: str, name: str
    ) -> PropertyKeyDefinition | None:
        stmt = (
            select(PropertyKeyDefinition)
            .where(PropertyKeyDefinition.version_id == version_id, PropertyKeyDefinition.name == name)
            .options(selectinload(PropertyKeyDefinition.validation_rules))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_property_keys(self, session: AsyncSession, version_id: str) -> list[PropertyKeyDefinition]:
        stmt = (
            select(PropertyKeyDefinition)
            .where(PropertyKeyDefinition.version_id == version_id)
            .options(selectinload(PropertyKeyDefinition.validation_rules))
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def update_property_key(
        self,
        session: AsyncSession,
        pk_id: str,
        **fields: object,
    ) -> PropertyKeyDefinition | None:
        pk = await self.get_property_key(session, pk_id)
        if pk is None:
            return None
        await self._ensure_draft(session, pk.version_id)

        # validation_rules is a relationship — handle as a full replace, not setattr.
        validation_rules = fields.pop("validation_rules", None)

        # Renames must stay unique within the version (uq_version_property_key).
        new_name = fields.get("name")
        if new_name is not None and new_name != pk.name:
            existing = await self.get_property_key_by_name(session, pk.version_id, new_name)
            if existing is not None and existing.id != pk.id:
                msg = f"Property key '{new_name}' already exists in this version."
                raise ValueError(msg)

        for key, value in fields.items():
            if value is not None and hasattr(pk, key):
                setattr(pk, key, value)

        if validation_rules is not None:
            for rule in list(pk.validation_rules):
                await session.delete(rule)
            await session.flush()
            for rule_data in validation_rules:
                session.add(
                    ValidationRule(
                        property_key_id=pk.id,
                        rule_type=rule_data["rule_type"],
                        params=rule_data.get("params", {}),
                    )
                )

        await session.flush()
        return await self.get_property_key(session, pk_id)

    async def delete_property_key(self, session: AsyncSession, pk_id: str) -> bool:
        pk = await self.get_property_key(session, pk_id)
        if pk is None:
            return False
        await self._ensure_draft(session, pk.version_id)
        await session.delete(pk)
        await session.flush()
        return True

    # ------------------------------------------------------------------
    # Node Type CRUD
    # ------------------------------------------------------------------
