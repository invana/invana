"""JSON export/import for schema versions.

``SchemaExporter`` serialises a ``GraphVersion`` (with all contained types,
property keys, mappings, constraints, rules, and indexes) into a
``SchemaExport`` Pydantic model that round-trips cleanly to JSON.

``SchemaImporter`` takes a ``SchemaExport`` and creates a new draft
``GraphVersion`` inside an existing ``GraphModel``.
"""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING

from invana.modeller.models import GraphVersion
from invana.modeller.schemas import (
    ConstraintCreate,
    EdgeTypeCreate,
    IndexCreate,
    NodeTypeCreate,
    PropertyKeyCreate,
    SchemaExport,
    TypePropertyMappingCreate,
    ValidationRuleSchema,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.modeller.store import ModelStore


# ---------------------------------------------------------------------------
# Exporter
# ---------------------------------------------------------------------------


class SchemaExporter:
    """Serialise a loaded ``GraphVersion`` to ``SchemaExport``."""

    @staticmethod
    def export(
        version: GraphVersion,
        schema_name: str,
        schema_description: str = "",
        validation_mode: str = "strict",
    ) -> SchemaExport:
        """Return a ``SchemaExport`` snapshot of *version*."""
        # Property keys
        property_keys: list[PropertyKeyCreate] = []
        for pk in version.property_keys:
            property_keys.append(
                PropertyKeyCreate(
                    name=pk.name,
                    type=pk.type,
                    value_cardinality=pk.value_cardinality,
                    description=pk.description,
                    validation_rules=[
                        ValidationRuleSchema(rule_type=r.rule_type, params=copy.deepcopy(r.params))
                        for r in pk.validation_rules
                    ],
                )
            )

        # Node types
        node_types: list[NodeTypeCreate] = []
        for nt in version.node_types:
            mappings = [
                TypePropertyMappingCreate(
                    property_key=m.property_key.name,
                    default_value=m.default_value,
                    sort_order=m.sort_order,
                    validation_rules=[
                        ValidationRuleSchema(rule_type=r.rule_type, params=copy.deepcopy(r.params))
                        for r in m.validation_rules
                    ],
                )
                for m in nt.property_mappings
            ]
            node_types.append(
                NodeTypeCreate(
                    name=nt.name,
                    description=nt.description,
                    parent_type=nt.parent_type,
                    is_abstract=nt.is_abstract,
                    validation_mode=nt.validation_mode,
                    property_mappings=mappings,
                )
            )

        # Edge types
        edge_types: list[EdgeTypeCreate] = []
        for et in version.edge_types:
            mappings = [
                TypePropertyMappingCreate(
                    property_key=m.property_key.name,
                    default_value=m.default_value,
                    sort_order=m.sort_order,
                    validation_rules=[
                        ValidationRuleSchema(rule_type=r.rule_type, params=copy.deepcopy(r.params))
                        for r in m.validation_rules
                    ],
                )
                for m in et.property_mappings
            ]
            edge_types.append(
                EdgeTypeCreate(
                    name=et.name,
                    description=et.description,
                    source_node_types=copy.deepcopy(et.source_node_types) or [],
                    target_node_types=copy.deepcopy(et.target_node_types) or [],
                    multiplicity=et.multiplicity,
                    property_mappings=mappings,
                )
            )

        # Constraints
        constraints: list[ConstraintCreate] = []
        for c in version.constraints:
            constraints.append(
                ConstraintCreate(
                    name=c.name,
                    target_kind=c.target_kind,
                    target_label=c.target_label,
                    constraint_type=c.constraint_type,
                    properties=copy.deepcopy(c.properties),
                )
            )

        # Indexes
        indexes: list[IndexCreate] = []
        for idx in version.indexes:
            indexes.append(
                IndexCreate(
                    name=idx.name,
                    target_kind=idx.target_kind,
                    target_label=idx.target_label,
                    properties=copy.deepcopy(idx.properties),
                    index_type=idx.index_type,
                    index_options=copy.deepcopy(idx.index_options) if idx.index_options else None,
                )
            )

        return SchemaExport(
            schema_name=schema_name,
            schema_description=schema_description,
            validation_mode=validation_mode,
            version=version.version,
            property_keys=property_keys,
            node_types=node_types,
            edge_types=edge_types,
            constraints=constraints,
            indexes=indexes,
        )


# ---------------------------------------------------------------------------
# Importer
# ---------------------------------------------------------------------------


class SchemaImporter:
    """Import a ``SchemaExport`` into an existing schema as a new draft."""

    def __init__(self, store: ModelStore) -> None:
        self._store = store

    async def import_schema(
        self,
        session: AsyncSession,
        *,
        model_id: str,
        data: SchemaExport,
    ) -> str:
        """Create a new draft version from *data*.

        Returns the new version ID.
        """
        version = await self._store.create_version(session, model_id=model_id)

        # Import property keys first (node/edge types reference them by name)
        for pk_data in data.property_keys:
            await self._store.create_property_key(
                session,
                version_id=version.id,
                name=pk_data.name,
                type=pk_data.type,
                value_cardinality=pk_data.value_cardinality,
                description=pk_data.description,
                validation_rules=[{"rule_type": r.rule_type, "params": r.params} for r in pk_data.validation_rules],
            )

        # Import node types
        for nt_data in data.node_types:
            mappings = [
                {
                    "property_key": m.property_key,
                    "default_value": m.default_value,
                    "sort_order": m.sort_order,
                    "validation_rules": [{"rule_type": r.rule_type, "params": r.params} for r in m.validation_rules],
                }
                for m in nt_data.property_mappings
            ]
            await self._store.create_node_type(
                session,
                version_id=version.id,
                name=nt_data.name,
                description=nt_data.description,
                parent_type=nt_data.parent_type,
                is_abstract=nt_data.is_abstract,
                validation_mode=nt_data.validation_mode,
                property_mappings=mappings,
            )

        # Import edge types
        for et_data in data.edge_types:
            mappings = [
                {
                    "property_key": m.property_key,
                    "default_value": m.default_value,
                    "sort_order": m.sort_order,
                    "validation_rules": [{"rule_type": r.rule_type, "params": r.params} for r in m.validation_rules],
                }
                for m in et_data.property_mappings
            ]
            await self._store.create_edge_type(
                session,
                version_id=version.id,
                name=et_data.name,
                description=et_data.description,
                source_node_types=et_data.source_node_types,
                target_node_types=et_data.target_node_types,
                multiplicity=et_data.multiplicity,
                property_mappings=mappings,
            )

        # Import constraints
        for c_data in data.constraints:
            await self._store.create_constraint(
                session,
                version_id=version.id,
                name=c_data.name,
                target_kind=c_data.target_kind,
                target_label=c_data.target_label,
                constraint_type=c_data.constraint_type,
                properties=c_data.properties,
            )

        # Import indexes
        for idx_data in data.indexes:
            await self._store.create_index(
                session,
                version_id=version.id,
                name=idx_data.name,
                target_kind=idx_data.target_kind,
                target_label=idx_data.target_label,
                properties=idx_data.properties,
                index_type=idx_data.index_type,
                index_options=idx_data.index_options,
            )

        return version.id
