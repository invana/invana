"""JSON export/import for schema versions.

``SchemaExporter`` serialises a ``SchemaVersion`` (with all contained types,
properties, rules, and indexes) into a ``SchemaExport`` Pydantic model that
round-trips cleanly to JSON.

``SchemaImporter`` takes a ``SchemaExport`` and creates a new draft
``SchemaVersion`` inside an existing ``GraphSchema``.
"""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING

from invana.modeller.models import SchemaVersion
from invana.modeller.schemas import (
    EdgeTypeCreate,
    IndexCreate,
    NodeTypeCreate,
    PropertyCreate,
    SchemaExport,
    ValidationRuleSchema,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.modeller.store import SchemaStore


# ---------------------------------------------------------------------------
# Exporter
# ---------------------------------------------------------------------------


class SchemaExporter:
    """Serialise a loaded ``SchemaVersion`` to ``SchemaExport``."""

    @staticmethod
    def export(
        version: SchemaVersion,
        schema_name: str,
        schema_description: str = "",
        validation_mode: str = "strict",
    ) -> SchemaExport:
        """Return a ``SchemaExport`` snapshot of *version*."""
        node_types: list[NodeTypeCreate] = []
        for nt in version.node_types:
            props = [
                PropertyCreate(
                    name=p.name,
                    type=p.type,
                    value_cardinality=p.value_cardinality,
                    required=p.required,
                    unique=p.unique,
                    default_value=p.default_value,
                    sort_order=p.sort_order,
                    validation_rules=[
                        ValidationRuleSchema(rule_type=r.rule_type, params=copy.deepcopy(r.params))
                        for r in p.validation_rules
                    ],
                )
                for p in nt.properties
            ]
            node_types.append(
                NodeTypeCreate(
                    name=nt.name,
                    description=nt.description,
                    parent_type=nt.parent_type,
                    is_abstract=nt.is_abstract,
                    validation_mode=nt.validation_mode,
                    color=nt.color,
                    icon=nt.icon,
                    properties=props,
                )
            )

        edge_types: list[EdgeTypeCreate] = []
        for et in version.edge_types:
            props = [
                PropertyCreate(
                    name=p.name,
                    type=p.type,
                    value_cardinality=p.value_cardinality,
                    required=p.required,
                    unique=p.unique,
                    default_value=p.default_value,
                    sort_order=p.sort_order,
                    validation_rules=[
                        ValidationRuleSchema(rule_type=r.rule_type, params=copy.deepcopy(r.params))
                        for r in p.validation_rules
                    ],
                )
                for p in et.properties
            ]
            edge_types.append(
                EdgeTypeCreate(
                    name=et.name,
                    description=et.description,
                    source_node_types=copy.deepcopy(et.source_node_types) or [],
                    target_node_types=copy.deepcopy(et.target_node_types) or [],
                    multiplicity=et.multiplicity,
                    allowed_properties=copy.deepcopy(et.allowed_properties) if et.allowed_properties else None,
                    properties=props,
                )
            )

        indexes: list[IndexCreate] = []
        for idx in version.indexes:
            indexes.append(
                IndexCreate(
                    name=idx.name,
                    target_kind=idx.target_kind,
                    target_label=idx.target_label,
                    properties=copy.deepcopy(idx.properties),
                    index_type=idx.index_type,
                    is_unique=idx.is_unique,
                    index_options=copy.deepcopy(idx.index_options) if idx.index_options else None,
                )
            )

        return SchemaExport(
            schema_name=schema_name,
            schema_description=schema_description,
            validation_mode=validation_mode,
            version=version.version,
            node_types=node_types,
            edge_types=edge_types,
            indexes=indexes,
        )


# ---------------------------------------------------------------------------
# Importer
# ---------------------------------------------------------------------------


class SchemaImporter:
    """Import a ``SchemaExport`` into an existing schema as a new draft."""

    def __init__(self, store: SchemaStore) -> None:
        self._store = store

    async def import_schema(
        self,
        session: AsyncSession,
        *,
        schema_id: str,
        data: SchemaExport,
    ) -> str:
        """Create a new draft version from *data*.

        Returns the new version ID.
        """
        version = await self._store.create_version(session, schema_id=schema_id)

        # Import node types
        for nt_data in data.node_types:
            props = [
                {
                    "name": p.name,
                    "type": p.type,
                    "value_cardinality": p.value_cardinality,
                    "required": p.required,
                    "unique": p.unique,
                    "default_value": p.default_value,
                    "sort_order": p.sort_order,
                    "validation_rules": [{"rule_type": r.rule_type, "params": r.params} for r in p.validation_rules],
                }
                for p in nt_data.properties
            ]
            await self._store.create_node_type(
                session,
                version_id=version.id,
                name=nt_data.name,
                description=nt_data.description,
                parent_type=nt_data.parent_type,
                is_abstract=nt_data.is_abstract,
                validation_mode=nt_data.validation_mode,
                color=nt_data.color,
                icon=nt_data.icon,
                properties=props,
            )

        # Import edge types
        for et_data in data.edge_types:
            props = [
                {
                    "name": p.name,
                    "type": p.type,
                    "value_cardinality": p.value_cardinality,
                    "required": p.required,
                    "unique": p.unique,
                    "default_value": p.default_value,
                    "sort_order": p.sort_order,
                    "validation_rules": [{"rule_type": r.rule_type, "params": r.params} for r in p.validation_rules],
                }
                for p in et_data.properties
            ]
            await self._store.create_edge_type(
                session,
                version_id=version.id,
                name=et_data.name,
                description=et_data.description,
                source_node_types=et_data.source_node_types,
                target_node_types=et_data.target_node_types,
                multiplicity=et_data.multiplicity,
                allowed_properties=et_data.allowed_properties,
                properties=props,
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
                is_unique=idx_data.is_unique,
                index_options=idx_data.index_options,
            )

        return version.id
