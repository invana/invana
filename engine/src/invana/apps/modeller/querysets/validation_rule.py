"""Queries against ``validation_rules`` — a property's constraints on a draft."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from invana.apps.modeller.constraints import VALUE_RULES
from invana.apps.modeller.models import TypePropertyMapping, ValidationRule

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
from invana.apps.modeller.querysets.base import VersionScopedQuerySet


class ValidationRuleQuerySet(VersionScopedQuerySet):
    async def own_mapping(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        node_type_id: str | None,
        edge_type_id: str | None,
        property_key: str,
    ) -> TypePropertyMapping:
        """A type's own mapping of ``property_key`` on a draft, written when the type only inherits it."""
        await self._ensure_draft(session, version_id)
        return await self._create_type_property_mapping(
            session,
            version_id=version_id,
            node_type_id=node_type_id,
            edge_type_id=edge_type_id,
            property_key=property_key,
        )

    async def replace_value_rule(
        self, session: AsyncSession, *, version_id: str, mapping: TypePropertyMapping, fields: dict[str, Any]
    ) -> ValidationRule:
        """Put ``fields`` in place of the mapping's range, enum or standard rule; other rules stay."""
        await self._ensure_draft(session, version_id)
        stmt = select(ValidationRule).where(
            ValidationRule.type_property_mapping_id == mapping.id, ValidationRule.rule_type.in_(VALUE_RULES)
        )
        for rule in (await session.execute(stmt)).scalars().all():
            await session.delete(rule)
        rule = ValidationRule(type_property_mapping_id=mapping.id, **ValidationRule.fields_of(fields))
        session.add(rule)
        await session.flush()
        return rule

    async def delete_rule(self, session: AsyncSession, *, version_id: str, rule: ValidationRule) -> None:
        await self._ensure_draft(session, version_id)
        await session.delete(rule)
        await session.flush()
