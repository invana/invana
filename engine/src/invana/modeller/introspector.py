"""Introspector — reverse-engineers a schema draft from a live database.

Walks the connector's ``schema_reader`` to discover labels, properties,
indexes, and constraints, then creates a new draft ``GraphVersion``
representing the current database state.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from invana.graph.types.constants import Capability

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.graph.connectors.base.connector import BaseConnector
    from invana.modeller.store import SchemaStore

logger = logging.getLogger(__name__)

# Map from IndexInfo.type to IndexDefinition.index_type
_INDEX_TYPE_MAP: dict[str, str] = {
    "btree": "range",
    "range": "range",
    "fulltext": "fulltext",
    "composite": "composite",
    "text": "text",
    "point": "point",
    "lookup": "lookup",
    "vector": "range",  # vector indexes handled separately
}


class Introspector:
    """Reverse-engineers a schema draft from a live database."""

    def __init__(self, store: SchemaStore) -> None:
        self._store = store

    async def introspect(
        self,
        session: AsyncSession,
        *,
        model_id: str,
        connector: BaseConnector,
    ) -> dict[str, Any]:
        """Discover the database schema and create a draft version.

        Returns a dict with ``{"version_id", "status", "discovered"}``.
        """
        caps = connector.capabilities()
        reader = connector.schema_reader

        # 1. Create a new draft version
        version = await self._store.create_version(session, model_id=model_id)
        discovered: dict[str, int] = {}

        # 2. Discover node labels + properties
        node_labels = await reader.get_node_labels()
        discovered["node_labels"] = len(node_labels)

        # Collect properties per label first so property keys can be created up-front
        node_properties: dict[str, list[dict]] = {}
        for label in node_labels:
            node_properties[label] = await self._discover_node_properties(reader, label, caps)

        await self._ensure_property_keys(session, version.id, node_properties.values())

        for label in node_labels:
            props = node_properties[label]
            property_mappings = [{"property_key": p["name"]} for p in props] or None
            await self._store.create_node_type(
                session,
                version_id=version.id,
                name=label,
                property_mappings=property_mappings,
            )

        # 3. Discover edge labels + properties + endpoints
        edge_labels = await reader.get_edge_labels()
        discovered["edge_labels"] = len(edge_labels)

        edge_infos: dict[str, dict] = {}
        for label in edge_labels:
            edge_infos[label] = await self._discover_edge_info(reader, label, caps)

        await self._ensure_property_keys(
            session,
            version.id,
            (info.get("properties", []) for info in edge_infos.values()),
        )

        for label in edge_labels:
            edge_info = edge_infos[label]
            props = edge_info.get("properties", [])
            property_mappings = [{"property_key": p["name"]} for p in props] or None
            await self._store.create_edge_type(
                session,
                version_id=version.id,
                name=label,
                source_node_types=edge_info.get("source_node_types", []),
                target_node_types=edge_info.get("target_node_types", []),
                multiplicity=edge_info.get("multiplicity", "MULTI"),
                property_mappings=property_mappings,
            )

        # 4. Discover indexes
        indexes = await reader.get_indexes()
        discovered["indexes"] = len(indexes)

        for idx in indexes:
            index_type = _INDEX_TYPE_MAP.get(idx.type, "range")
            try:
                await self._store.create_index(
                    session,
                    version_id=version.id,
                    name=idx.name,
                    target_kind="node_type",  # DB indexes don't distinguish; default to node
                    target_label=idx.label,
                    properties=idx.properties,
                    index_type=index_type,
                )
            except Exception:
                logger.warning("Failed to import index %s", idx.name, exc_info=True)

        # 5. Discover constraints and persist as ConstraintDefinition records
        constraints = await reader.get_constraints()
        discovered["constraints"] = len(constraints)

        for constraint in constraints:
            try:
                await self._store.create_constraint(
                    session,
                    version_id=version.id,
                    name=constraint.name,
                    target_kind="node_type",
                    target_label=constraint.label,
                    constraint_type=constraint.type,
                    properties=constraint.properties,
                )
            except Exception:
                logger.warning("Failed to import constraint %s", constraint.name, exc_info=True)

        await session.flush()

        # 6. Activate the newly built version so it is immediately queryable.
        from invana.modeller.versioner import Versioner  # noqa: PLC0415

        versioner = Versioner(self._store)
        await versioner.activate(
            session,
            version_id=version.id,
            change_summary="Auto-introspected from live database",
        )
        await session.flush()

        return {
            "version_id": version.id,
            "status": "active",
            "discovered": discovered,
        }

    # ------------------------------------------------------------------
    # Discovery helpers
    # ------------------------------------------------------------------

    async def _ensure_property_keys(
        self,
        session: AsyncSession,
        version_id: str,
        prop_lists: Any,
    ) -> None:
        """Create PropertyKeyDefinition for each unique property name not yet in this version."""
        seen: set[str] = set()
        for props in prop_lists:
            for prop in props:
                name = prop["name"]
                if name in seen:
                    continue
                seen.add(name)
                existing = await self._store.get_property_key_by_name(session, version_id, name)
                if existing is None:
                    await self._store.create_property_key(
                        session,
                        version_id=version_id,
                        name=name,
                        type=prop.get("type", "string"),
                        value_cardinality=prop.get("value_cardinality", "SINGLE"),
                    )

    async def _discover_node_properties(
        self,
        reader: Any,
        label: str,
        caps: set[Capability],
    ) -> list[dict]:
        """Discover properties for a node label, inferring types where possible."""
        properties: list[dict] = []
        try:
            prop_schemas = await reader.get_property_schema(label)
            for ps in prop_schemas:
                prop: dict[str, Any] = {
                    "name": ps.name,
                    "type": ps.inferred_type,
                }
                if Capability.PROPERTY_CARDINALITY in caps:
                    try:
                        cardinality = await reader.get_property_cardinality(label, ps.name)
                        prop["value_cardinality"] = cardinality
                    except Exception:
                        pass
                properties.append(prop)
        except Exception:
            # Fallback to simple property keys without type inference
            logger.debug("Property schema unavailable for %s, falling back to keys", label)
            keys = await reader.get_property_keys(label)
            for key in keys:
                properties.append({"name": key, "type": "string"})

        return properties

    async def _discover_edge_info(
        self,
        reader: Any,
        label: str,
        caps: set[Capability],
    ) -> dict[str, Any]:
        """Discover edge endpoints, multiplicity, and properties."""
        info: dict[str, Any] = {}

        try:
            edge_schema = await reader.get_edge_schema(label)
            info["source_node_types"] = edge_schema.source_labels
            info["target_node_types"] = edge_schema.target_labels
            # Discover edge properties
            properties: list[dict] = []
            for key in edge_schema.property_keys:
                properties.append({"name": key, "type": "string"})
            info["properties"] = properties
        except Exception:
            logger.debug("Edge schema unavailable for %s", label)

        # Multiplicity (Gremlin vendors)
        try:
            multiplicity = await reader.get_edge_multiplicity(label)
            info["multiplicity"] = multiplicity
        except Exception:
            info["multiplicity"] = "MULTI"

        return info
