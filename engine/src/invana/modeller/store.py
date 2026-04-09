"""SchemaStore — CRUD operations on graph schemas, versions, types, and rules.

All methods accept an ``AsyncSession`` so the caller controls the transaction
boundary. The store never commits — callers should ``await session.commit()``
when appropriate.
"""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from invana.modeller.models import (
    EdgeTypeDefinition,
    GraphSchema,
    IndexDefinition,
    NodeTypeDefinition,
    PropertyDefinition,
    SchemaProjection,
    SchemaVersion,
    ValidationRule,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# ---------------------------------------------------------------------------
# Eager-loading helpers
# ---------------------------------------------------------------------------

_VERSION_EAGER = (
    selectinload(SchemaVersion.node_types)
    .selectinload(NodeTypeDefinition.properties)
    .selectinload(PropertyDefinition.validation_rules),
    selectinload(SchemaVersion.edge_types)
    .selectinload(EdgeTypeDefinition.properties)
    .selectinload(PropertyDefinition.validation_rules),
    selectinload(SchemaVersion.indexes),
    selectinload(SchemaVersion.projections),
)

_SCHEMA_EAGER = (selectinload(GraphSchema.versions),)


class SchemaStore:
    """CRUD operations for the graph schema editor's app-state tables."""

    # ------------------------------------------------------------------
    # Schema CRUD
    # ------------------------------------------------------------------

    async def create_schema(
        self,
        session: AsyncSession,
        *,
        name: str,
        description: str = "",
        validation_mode: str = "strict",
    ) -> GraphSchema:
        schema = GraphSchema(name=name, description=description, validation_mode=validation_mode)
        session.add(schema)
        await session.flush()
        return schema

    async def get_schema(self, session: AsyncSession, schema_id: str) -> GraphSchema | None:
        stmt = select(GraphSchema).where(GraphSchema.id == schema_id).options(*_SCHEMA_EAGER)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_schemas(self, session: AsyncSession) -> list[GraphSchema]:
        stmt = select(GraphSchema).options(*_SCHEMA_EAGER).order_by(GraphSchema.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def update_schema(
        self,
        session: AsyncSession,
        schema_id: str,
        **fields: object,
    ) -> GraphSchema | None:
        schema = await self.get_schema(session, schema_id)
        if schema is None:
            return None
        for key, value in fields.items():
            if value is not None and hasattr(schema, key):
                setattr(schema, key, value)
        await session.flush()
        return schema

    async def delete_schema(self, session: AsyncSession, schema_id: str) -> bool:
        schema = await self.get_schema(session, schema_id)
        if schema is None:
            return False
        await session.delete(schema)
        await session.flush()
        return True

    # ------------------------------------------------------------------
    # Version CRUD
    # ------------------------------------------------------------------

    async def create_version(
        self,
        session: AsyncSession,
        *,
        schema_id: str,
        based_on: str | None = None,
    ) -> SchemaVersion:
        # Ensure no existing draft
        stmt = select(SchemaVersion).where(SchemaVersion.schema_id == schema_id, SchemaVersion.status == "draft")
        result = await session.execute(stmt)
        existing_draft = result.scalar_one_or_none()
        if existing_draft is not None:
            msg = "A draft version already exists for this schema."
            raise ValueError(msg)

        version = SchemaVersion(schema_id=schema_id)
        session.add(version)
        await session.flush()

        # Clone from an existing version if requested
        if based_on is not None:
            source = await self.get_version_by_semver(session, schema_id, based_on)
            if source is None:
                msg = f"Source version '{based_on}' not found."
                raise ValueError(msg)
            await self._clone_version_contents(session, source, version)

        return version

    async def get_version(self, session: AsyncSession, version_id: str) -> SchemaVersion | None:
        stmt = select(SchemaVersion).where(SchemaVersion.id == version_id).options(*_VERSION_EAGER)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_version_by_semver(self, session: AsyncSession, schema_id: str, semver: str) -> SchemaVersion | None:
        stmt = (
            select(SchemaVersion)
            .where(SchemaVersion.schema_id == schema_id, SchemaVersion.version == semver)
            .options(*_VERSION_EAGER)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_version(self, session: AsyncSession, schema_id: str) -> SchemaVersion | None:
        stmt = (
            select(SchemaVersion)
            .where(SchemaVersion.schema_id == schema_id, SchemaVersion.status == "active")
            .options(*_VERSION_EAGER)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_versions(self, session: AsyncSession, schema_id: str) -> list[SchemaVersion]:
        stmt = select(SchemaVersion).where(SchemaVersion.schema_id == schema_id).order_by(SchemaVersion.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Node Type CRUD
    # ------------------------------------------------------------------

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
        color: str | None = None,
        icon: str | None = None,
        properties: list[dict] | None = None,
    ) -> NodeTypeDefinition:
        await self._ensure_draft(session, version_id)

        node_type = NodeTypeDefinition(
            version_id=version_id,
            name=name,
            description=description,
            parent_type=parent_type,
            is_abstract=is_abstract,
            validation_mode=validation_mode,
            color=color,
            icon=icon,
        )
        session.add(node_type)
        await session.flush()

        if properties:
            for prop_data in properties:
                await self._create_property(session, node_type_id=node_type.id, **prop_data)

        # Reload with eager-loaded properties
        return await self.get_node_type(session, node_type.id)

    async def get_node_type(self, session: AsyncSession, node_type_id: str) -> NodeTypeDefinition | None:
        stmt = (
            select(NodeTypeDefinition)
            .where(NodeTypeDefinition.id == node_type_id)
            .options(selectinload(NodeTypeDefinition.properties).selectinload(PropertyDefinition.validation_rules))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_node_types(self, session: AsyncSession, version_id: str) -> list[NodeTypeDefinition]:
        stmt = (
            select(NodeTypeDefinition)
            .where(NodeTypeDefinition.version_id == version_id)
            .options(selectinload(NodeTypeDefinition.properties).selectinload(PropertyDefinition.validation_rules))
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
        for key, value in fields.items():
            if value is not None and hasattr(nt, key):
                setattr(nt, key, value)
        await session.flush()
        return nt

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
        allowed_properties: list[str] | None = None,
        properties: list[dict] | None = None,
    ) -> EdgeTypeDefinition:
        await self._ensure_draft(session, version_id)

        edge_type = EdgeTypeDefinition(
            version_id=version_id,
            name=name,
            description=description,
            source_node_types=source_node_types or [],
            target_node_types=target_node_types or [],
            multiplicity=multiplicity,
            allowed_properties=allowed_properties,
        )
        session.add(edge_type)
        await session.flush()

        if properties:
            for prop_data in properties:
                await self._create_property(session, edge_type_id=edge_type.id, **prop_data)

        # Reload with eager-loaded properties
        return await self.get_edge_type(session, edge_type.id)

    async def get_edge_type(self, session: AsyncSession, edge_type_id: str) -> EdgeTypeDefinition | None:
        stmt = (
            select(EdgeTypeDefinition)
            .where(EdgeTypeDefinition.id == edge_type_id)
            .options(selectinload(EdgeTypeDefinition.properties).selectinload(PropertyDefinition.validation_rules))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_edge_types(self, session: AsyncSession, version_id: str) -> list[EdgeTypeDefinition]:
        stmt = (
            select(EdgeTypeDefinition)
            .where(EdgeTypeDefinition.version_id == version_id)
            .options(selectinload(EdgeTypeDefinition.properties).selectinload(PropertyDefinition.validation_rules))
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
        for key, value in fields.items():
            if value is not None and hasattr(et, key):
                setattr(et, key, value)
        await session.flush()
        return et

    async def delete_edge_type(self, session: AsyncSession, edge_type_id: str) -> bool:
        et = await self.get_edge_type(session, edge_type_id)
        if et is None:
            return False
        await self._ensure_draft(session, et.version_id)
        await session.delete(et)
        await session.flush()
        return True

    # ------------------------------------------------------------------
    # Index CRUD
    # ------------------------------------------------------------------

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
        is_unique: bool = False,
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
            is_unique=is_unique,
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
        self, session: AsyncSession, schema_id: str, connector_id: str
    ) -> SchemaProjection | None:
        stmt = (
            select(SchemaProjection)
            .join(SchemaVersion)
            .where(
                SchemaVersion.schema_id == schema_id,
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

    async def _ensure_draft(self, session: AsyncSession, version_id: str) -> None:
        stmt = select(SchemaVersion.status).where(SchemaVersion.id == version_id)
        result = await session.execute(stmt)
        status = result.scalar_one_or_none()
        if status != "draft":
            msg = f"Version {version_id} is not a draft (status={status}). Only draft versions can be modified."
            raise ValueError(msg)

    async def _create_property(
        self,
        session: AsyncSession,
        *,
        node_type_id: str | None = None,
        edge_type_id: str | None = None,
        name: str,
        type: str = "string",
        value_cardinality: str = "SINGLE",
        required: bool = False,
        unique: bool = False,
        default_value: str | None = None,
        sort_order: int = 0,
        validation_rules: list[dict] | None = None,
    ) -> PropertyDefinition:
        prop = PropertyDefinition(
            node_type_id=node_type_id,
            edge_type_id=edge_type_id,
            name=name,
            type=type,
            value_cardinality=value_cardinality,
            required=required,
            unique=unique,
            default_value=default_value,
            sort_order=sort_order,
        )
        session.add(prop)
        await session.flush()

        if validation_rules:
            for rule_data in validation_rules:
                rule = ValidationRule(
                    property_id=prop.id,
                    rule_type=rule_data["rule_type"],
                    params=rule_data.get("params", {}),
                )
                session.add(rule)

        await session.flush()
        return prop

    async def _clone_version_contents(
        self,
        session: AsyncSession,
        source: SchemaVersion,
        target: SchemaVersion,
    ) -> None:
        """Deep-clone node types, edge types, indexes, and properties from *source* into *target*."""
        # Reload with eager loading
        source = await self.get_version(session, source.id)
        if source is None:
            return

        # Clone node types
        for nt in source.node_types:
            props = [
                {
                    "name": p.name,
                    "type": p.type,
                    "value_cardinality": p.value_cardinality,
                    "required": p.required,
                    "unique": p.unique,
                    "default_value": p.default_value,
                    "sort_order": p.sort_order,
                    "validation_rules": [
                        {"rule_type": r.rule_type, "params": copy.deepcopy(r.params)} for r in p.validation_rules
                    ],
                }
                for p in nt.properties
            ]
            await self.create_node_type(
                session,
                version_id=target.id,
                name=nt.name,
                description=nt.description,
                parent_type=nt.parent_type,
                is_abstract=nt.is_abstract,
                validation_mode=nt.validation_mode,
                color=nt.color,
                icon=nt.icon,
                properties=props,
            )

        # Clone edge types
        for et in source.edge_types:
            props = [
                {
                    "name": p.name,
                    "type": p.type,
                    "value_cardinality": p.value_cardinality,
                    "required": p.required,
                    "unique": p.unique,
                    "default_value": p.default_value,
                    "sort_order": p.sort_order,
                    "validation_rules": [
                        {"rule_type": r.rule_type, "params": copy.deepcopy(r.params)} for r in p.validation_rules
                    ],
                }
                for p in et.properties
            ]
            await self.create_edge_type(
                session,
                version_id=target.id,
                name=et.name,
                description=et.description,
                source_node_types=copy.deepcopy(et.source_node_types),
                target_node_types=copy.deepcopy(et.target_node_types),
                multiplicity=et.multiplicity,
                allowed_properties=copy.deepcopy(et.allowed_properties) if et.allowed_properties else None,
                properties=props,
            )

        # Clone indexes
        for idx in source.indexes:
            await self.create_index(
                session,
                version_id=target.id,
                name=idx.name,
                target_kind=idx.target_kind,
                target_label=idx.target_label,
                properties=copy.deepcopy(idx.properties),
                index_type=idx.index_type,
                is_unique=idx.is_unique,
                index_options=copy.deepcopy(idx.index_options) if idx.index_options else None,
            )
