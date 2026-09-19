"""What every modeller queryset shares.

``_ensure_draft`` is the guard that stops a published version being edited;
``_create_type_property_mapping`` writes the join row several type querysets
need; the ``*_eager`` helpers are the load options they all reuse.

One level of inheritance, deliberately — anything a second queryset needs goes
here or in a plain function, never in a sibling (migration-plan §14.7).
"""

from __future__ import annotations

from functools import cache
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from invana.apps.modeller.models import (
    EdgeTypeDefinition,
    GraphModel,
    GraphVersion,
    NodeTypeDefinition,
    PropertyKeyDefinition,
    TypePropertyMapping,
    ValidationRule,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


"""ModelStore — CRUD operations on graph schemas, versions, types, and rules.

All methods accept an ``AsyncSession`` so the caller controls the transaction
boundary. The store never commits — callers should ``await session.commit()``
when appropriate.
"""


@cache
def _mapping_eager() -> tuple:
    return (
        selectinload(TypePropertyMapping.property_key).selectinload(PropertyKeyDefinition.validation_rules),
        selectinload(TypePropertyMapping.validation_rules),
    )


@cache
def _version_eager() -> tuple:
    return (
        selectinload(GraphVersion.property_keys).selectinload(PropertyKeyDefinition.validation_rules),
        selectinload(GraphVersion.node_types)
        .selectinload(NodeTypeDefinition.property_mappings)
        .options(*_mapping_eager()),
        selectinload(GraphVersion.edge_types)
        .selectinload(EdgeTypeDefinition.property_mappings)
        .options(*_mapping_eager()),
        selectinload(GraphVersion.constraints),
        selectinload(GraphVersion.indexes),
        selectinload(GraphVersion.projections),
    )


@cache
def _model_eager() -> tuple:
    return (selectinload(GraphModel.versions),)


class VersionScopedQuerySet:
    """Sibling querysets are reached through lazy properties, not imports: the
    per-model modules import this one, so importing them back at module scope
    would close a circle."""

    @property
    def property_keys(self):
        from invana.apps.modeller.querysets.property_key import PropertyKeyQuerySet  # noqa: PLC0415

        return PropertyKeyQuerySet()

    @property
    def node_types(self):
        from invana.apps.modeller.querysets.node_type import NodeTypeQuerySet  # noqa: PLC0415

        return NodeTypeQuerySet()

    @property
    def edge_types(self):
        from invana.apps.modeller.querysets.edge_type import EdgeTypeQuerySet  # noqa: PLC0415

        return EdgeTypeQuerySet()

    @property
    def constraints(self):
        from invana.apps.modeller.querysets.constraint import ConstraintQuerySet  # noqa: PLC0415

        return ConstraintQuerySet()

    @property
    def indexes(self):
        from invana.apps.modeller.querysets.index import IndexQuerySet  # noqa: PLC0415

        return IndexQuerySet()

    async def _ensure_draft(self, session: AsyncSession, version_id: str) -> None:
        stmt = select(GraphVersion.status).where(GraphVersion.id == version_id)
        result = await session.execute(stmt)
        status = result.scalar_one_or_none()
        if status != "draft":
            msg = f"Version {version_id} is not a draft (status={status}). Only draft versions can be modified."
            raise ValueError(msg)

    async def _create_type_property_mapping(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        node_type_id: str | None = None,
        edge_type_id: str | None = None,
        property_key: str,
        default_value: str | None = None,
        sort_order: int = 0,
        validation_rules: list[dict] | None = None,
    ) -> TypePropertyMapping:
        # Look up the property key by name within this version
        pk = await self.property_keys.get_property_key_by_name(session, version_id, property_key)
        if pk is None:
            msg = f"Property key '{property_key}' not found in version {version_id}."
            raise ValueError(msg)

        mapping = TypePropertyMapping(
            property_key_id=pk.id,
            node_type_id=node_type_id,
            edge_type_id=edge_type_id,
            default_value=default_value,
            sort_order=sort_order,
        )
        session.add(mapping)
        await session.flush()

        if validation_rules:
            for rule_data in validation_rules:
                rule = ValidationRule(
                    type_property_mapping_id=mapping.id,
                    rule_type=rule_data["rule_type"],
                    params=rule_data.get("params", {}),
                )
                session.add(rule)
            await session.flush()

        return mapping
