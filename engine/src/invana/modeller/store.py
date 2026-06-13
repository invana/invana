"""ModelStore — CRUD operations on graph schemas, versions, types, and rules.

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
    ConstraintDefinition,
    EdgeTypeDefinition,
    GraphModel,
    GraphVersion,
    IndexDefinition,
    NodeTypeDefinition,
    PropertyKeyDefinition,
    SchemaProjection,
    TypePropertyMapping,
    ValidationRule,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# ---------------------------------------------------------------------------
# Eager-loading helpers
# ---------------------------------------------------------------------------

_MAPPING_EAGER = (
    selectinload(TypePropertyMapping.property_key).selectinload(PropertyKeyDefinition.validation_rules),
    selectinload(TypePropertyMapping.validation_rules),
)

_VERSION_EAGER = (
    selectinload(GraphVersion.property_keys).selectinload(PropertyKeyDefinition.validation_rules),
    selectinload(GraphVersion.node_types).selectinload(NodeTypeDefinition.property_mappings).options(*_MAPPING_EAGER),
    selectinload(GraphVersion.edge_types).selectinload(EdgeTypeDefinition.property_mappings).options(*_MAPPING_EAGER),
    selectinload(GraphVersion.constraints),
    selectinload(GraphVersion.indexes),
    selectinload(GraphVersion.projections),
)

_MODEL_EAGER = (selectinload(GraphModel.versions),)


class ModelStore:
    """CRUD operations for the graph modeller's app-state tables."""

    # ------------------------------------------------------------------
    # Graph model CRUD
    # ------------------------------------------------------------------

    async def create_graph_model(
        self,
        session: AsyncSession,
        *,
        name: str,
        graph_id: str | None = None,
        description: str = "",
        validation_mode: str = "strict",
        origin: str = "studio",
    ) -> GraphModel:
        graph_model = GraphModel(
            name=name,
            graph_id=graph_id,
            description=description,
            validation_mode=validation_mode,
            origin=origin,
        )
        session.add(graph_model)
        await session.flush()
        return graph_model

    async def get_introspected_model(self, session: AsyncSession, graph_id: str) -> GraphModel | None:
        """The graph's single system-managed 'global' model (origin=introspected), if any."""
        stmt = (
            select(GraphModel)
            .where(GraphModel.graph_id == graph_id, GraphModel.origin == "introspected")
            .options(*_MODEL_EAGER)
            .order_by(GraphModel.created_at)
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_graph_model(self, session: AsyncSession, model_id: str) -> GraphModel | None:
        stmt = select(GraphModel).where(GraphModel.id == model_id).options(*_MODEL_EAGER)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_graph_models(self, session: AsyncSession, graph_id: str | None = None) -> list[GraphModel]:
        stmt = select(GraphModel).options(*_MODEL_EAGER).order_by(GraphModel.created_at)
        if graph_id is not None:
            stmt = stmt.where(GraphModel.graph_id == graph_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def update_graph_model(
        self,
        session: AsyncSession,
        model_id: str,
        **fields: object,
    ) -> GraphModel | None:
        graph_model = await self.get_graph_model(session, model_id)
        if graph_model is None:
            return None
        for key, value in fields.items():
            if value is not None and hasattr(graph_model, key):
                setattr(graph_model, key, value)
        await session.flush()
        return graph_model

    async def delete_graph_model(self, session: AsyncSession, model_id: str) -> bool:
        graph_model = await self.get_graph_model(session, model_id)
        if graph_model is None:
            return False
        await session.delete(graph_model)
        await session.flush()
        return True

    # ------------------------------------------------------------------
    # Version CRUD
    # ------------------------------------------------------------------

    async def create_version(
        self,
        session: AsyncSession,
        *,
        model_id: str,
        based_on: str | None = None,
    ) -> GraphVersion:
        # Ensure no existing draft
        stmt = select(GraphVersion).where(GraphVersion.model_id == model_id, GraphVersion.status == "draft")
        result = await session.execute(stmt)
        existing_draft = result.scalar_one_or_none()
        if existing_draft is not None:
            msg = "A draft version already exists for this schema."
            raise ValueError(msg)

        version = GraphVersion(model_id=model_id)
        session.add(version)
        await session.flush()

        # Clone from an existing version if requested
        if based_on is not None:
            source = await self.get_version_by_semver(session, model_id, based_on)
            if source is None:
                msg = f"Source version '{based_on}' not found."
                raise ValueError(msg)
            await self._clone_version_contents(session, source, version)

        return version

    async def delete_draft_versions(self, session: AsyncSession, model_id: str) -> int:
        """Delete any draft versions of a model. Returns how many were removed.

        Used by introspection of the system-managed ``global`` model, which is
        fully rebuilt on every run: a stale draft left by a prior interrupted
        introspect would otherwise trip ``create_version``'s one-draft guard and
        block all future refreshes. ORM delete so version children cascade.
        """
        stmt = select(GraphVersion).where(GraphVersion.model_id == model_id, GraphVersion.status == "draft")
        result = await session.execute(stmt)
        drafts = list(result.scalars().all())
        for draft in drafts:
            await session.delete(draft)
        if drafts:
            await session.flush()
        return len(drafts)

    async def get_version(self, session: AsyncSession, version_id: str) -> GraphVersion | None:
        stmt = select(GraphVersion).where(GraphVersion.id == version_id).options(*_VERSION_EAGER)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_version_by_semver(self, session: AsyncSession, model_id: str, semver: str) -> GraphVersion | None:
        stmt = (
            select(GraphVersion)
            .where(GraphVersion.model_id == model_id, GraphVersion.version == semver)
            .options(*_VERSION_EAGER)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_version(self, session: AsyncSession, model_id: str) -> GraphVersion | None:
        stmt = (
            select(GraphVersion)
            .where(GraphVersion.model_id == model_id, GraphVersion.status == "active")
            .options(*_VERSION_EAGER)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_versions(self, session: AsyncSession, model_id: str) -> list[GraphVersion]:
        stmt = select(GraphVersion).where(GraphVersion.model_id == model_id).order_by(GraphVersion.created_at)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Property Key CRUD
    # ------------------------------------------------------------------

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

        return pk

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
            .options(selectinload(NodeTypeDefinition.property_mappings).options(*_MAPPING_EAGER))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_node_types(self, session: AsyncSession, version_id: str) -> list[NodeTypeDefinition]:
        stmt = (
            select(NodeTypeDefinition)
            .where(NodeTypeDefinition.version_id == version_id)
            .options(selectinload(NodeTypeDefinition.property_mappings).options(*_MAPPING_EAGER))
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
            .options(selectinload(EdgeTypeDefinition.property_mappings).options(*_MAPPING_EAGER))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_edge_types(self, session: AsyncSession, version_id: str) -> list[EdgeTypeDefinition]:
        stmt = (
            select(EdgeTypeDefinition)
            .where(EdgeTypeDefinition.version_id == version_id)
            .options(selectinload(EdgeTypeDefinition.property_mappings).options(*_MAPPING_EAGER))
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

    async def create_constraint(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        name: str,
        target_kind: str,
        target_label: str,
        constraint_type: str,
        properties: list[str],
    ) -> ConstraintDefinition:
        await self._ensure_draft(session, version_id)
        constraint = ConstraintDefinition(
            version_id=version_id,
            name=name,
            target_kind=target_kind,
            target_label=target_label,
            constraint_type=constraint_type,
            properties=properties,
        )
        session.add(constraint)
        await session.flush()
        return constraint

    async def get_constraint(self, session: AsyncSession, constraint_id: str) -> ConstraintDefinition | None:
        stmt = select(ConstraintDefinition).where(ConstraintDefinition.id == constraint_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_constraints(self, session: AsyncSession, version_id: str) -> list[ConstraintDefinition]:
        stmt = select(ConstraintDefinition).where(ConstraintDefinition.version_id == version_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def delete_constraint(self, session: AsyncSession, constraint_id: str) -> bool:
        constraint = await self.get_constraint(session, constraint_id)
        if constraint is None:
            return False
        await self._ensure_draft(session, constraint.version_id)
        await session.delete(constraint)
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
        pk = await self.get_property_key_by_name(session, version_id, property_key)
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

    async def _clone_version_contents(
        self,
        session: AsyncSession,
        source: GraphVersion,
        target: GraphVersion,
    ) -> None:
        """Deep-clone property keys, node types, edge types, constraints, and indexes."""
        # Reload with eager loading
        source = await self.get_version(session, source.id)
        if source is None:
            return

        # Clone property keys first (types and mappings depend on them)
        for pk in source.property_keys:
            await self.create_property_key(
                session,
                version_id=target.id,
                name=pk.name,
                type=pk.type,
                value_cardinality=pk.value_cardinality,
                description=pk.description,
                validation_rules=[
                    {"rule_type": r.rule_type, "params": copy.deepcopy(r.params)} for r in pk.validation_rules
                ],
            )

        # Clone node types
        for nt in source.node_types:
            mappings = [
                {
                    "property_key": m.property_key.name,
                    "default_value": m.default_value,
                    "sort_order": m.sort_order,
                    "validation_rules": [
                        {"rule_type": r.rule_type, "params": copy.deepcopy(r.params)} for r in m.validation_rules
                    ],
                }
                for m in nt.property_mappings
            ]
            await self.create_node_type(
                session,
                version_id=target.id,
                name=nt.name,
                description=nt.description,
                parent_type=nt.parent_type,
                is_abstract=nt.is_abstract,
                validation_mode=nt.validation_mode,
                property_mappings=mappings,
            )

        # Clone edge types
        for et in source.edge_types:
            mappings = [
                {
                    "property_key": m.property_key.name,
                    "default_value": m.default_value,
                    "sort_order": m.sort_order,
                    "validation_rules": [
                        {"rule_type": r.rule_type, "params": copy.deepcopy(r.params)} for r in m.validation_rules
                    ],
                }
                for m in et.property_mappings
            ]
            await self.create_edge_type(
                session,
                version_id=target.id,
                name=et.name,
                description=et.description,
                source_node_types=copy.deepcopy(et.source_node_types),
                target_node_types=copy.deepcopy(et.target_node_types),
                multiplicity=et.multiplicity,
                property_mappings=mappings,
            )

        # Clone constraints
        for c in source.constraints:
            await self.create_constraint(
                session,
                version_id=target.id,
                name=c.name,
                target_kind=c.target_kind,
                target_label=c.target_label,
                constraint_type=c.constraint_type,
                properties=copy.deepcopy(c.properties),
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
                index_options=copy.deepcopy(idx.index_options) if idx.index_options else None,
            )
