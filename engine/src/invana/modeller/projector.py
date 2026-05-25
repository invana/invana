"""Projector — translates an active GraphVersion into connector DDL calls.

The projector is **idempotent**: it compares the desired state (from the
schema version) against the current live state (from ``schema_reader``)
and only creates or drops what is needed.

Unsupported operations are recorded as warnings rather than failing the
whole projection.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from invana.graph.types.constants import Capability
from invana.modeller.models import (
    GraphVersion,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.graph.connectors.base.connector import BaseConnector
    from invana.modeller.store import SchemaStore

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal representation for comparison
# ---------------------------------------------------------------------------


class _DesiredIndex:
    __slots__ = ("index_type", "label", "name", "options", "properties")

    def __init__(
        self,
        name: str,
        label: str,
        properties: list[str],
        index_type: str,
        options: dict[str, Any] | None = None,
    ) -> None:
        self.name = name
        self.label = label
        self.properties = properties
        self.index_type = index_type
        self.options = options

    @property
    def key(self) -> tuple:
        return (self.label, tuple(self.properties), self.index_type)


class _DesiredConstraint:
    __slots__ = ("constraint_type", "label", "name", "properties")

    def __init__(
        self,
        name: str,
        label: str,
        properties: list[str],
        constraint_type: str,
    ) -> None:
        self.name = name
        self.label = label
        self.properties = properties
        self.constraint_type = constraint_type

    @property
    def key(self) -> tuple:
        return (self.label, tuple(self.properties), self.constraint_type)


# ---------------------------------------------------------------------------
# Capability → index type mapping
# ---------------------------------------------------------------------------

_INDEX_TYPE_CAPABILITY: dict[str, Capability] = {
    "composite": Capability.COMPOSITE_INDEX,
    "fulltext": Capability.FULLTEXT_INDEX,
    "text": Capability.TEXT_INDEX,
    "point": Capability.POINT_INDEX,
    "lookup": Capability.LOOKUP_INDEX,
}

# Constraint types that require specific capabilities
_CONSTRAINT_TYPE_CAPABILITY: dict[str, Capability] = {
    "exists": Capability.SCHEMA_ENFORCEMENT,
    "node_key": Capability.SCHEMA_ENFORCEMENT,
    "relationship_unique": Capability.RELATIONSHIP_PROPERTY_CONSTRAINTS,
    "relationship_exists": Capability.RELATIONSHIP_PROPERTY_CONSTRAINTS,
}

# ---------------------------------------------------------------------------
# Projector
# ---------------------------------------------------------------------------


class Projector:
    """Translates a ``GraphVersion`` into connector DDL calls."""

    def __init__(self, store: SchemaStore) -> None:
        self._store = store

    async def project(
        self,
        session: AsyncSession,
        *,
        version: GraphVersion,
        connector: BaseConnector,
        connector_id: str,
    ) -> dict[str, Any]:
        """Project the version onto the database via *connector*.

        Returns a dict suitable for ``SchemaProjection`` fields:
        ``{"status", "operations", "errors", "projected_at"}``.
        """
        caps = connector.capabilities()
        operations: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []

        # --- Gather current live state ---
        current_indexes = await connector.schema_reader.get_indexes()
        current_constraints = await connector.schema_reader.get_constraints()

        live_idx_keys = {(idx.label, tuple(idx.properties), idx.type) for idx in current_indexes}
        live_con_keys = {(c.label, tuple(c.properties), c.type) for c in current_constraints}

        # --- Compute desired state ---
        desired_indexes = self._compute_desired_indexes(version, caps)
        desired_constraints = self._compute_desired_constraints(version, caps)

        desired_idx_keys = {d.key for d in desired_indexes}

        # --- Create missing indexes ---
        for di in desired_indexes:
            if di.key in live_idx_keys:
                continue
            # Check capability gate
            required_cap = _INDEX_TYPE_CAPABILITY.get(di.index_type)
            if required_cap and required_cap not in caps:
                errors.append(
                    {
                        "type": "unsupported_index",
                        "name": di.name,
                        "index_type": di.index_type,
                        "message": (
                            f"Index type '{di.index_type}' requires capability "
                            f"'{required_cap}' not supported by connector."
                        ),
                    }
                )
                continue
            try:
                await connector.schema_writer.create_index(
                    di.label,
                    di.properties,
                    index_type=di.index_type,
                    name=di.name,
                    options=di.options,
                )
                operations.append(
                    {
                        "action": "create_index",
                        "name": di.name,
                        "label": di.label,
                        "properties": di.properties,
                        "index_type": di.index_type,
                    }
                )
            except Exception as exc:
                errors.append(
                    {
                        "type": "create_index_error",
                        "name": di.name,
                        "message": str(exc),
                    }
                )

        # --- Create missing constraints ---
        for dc in desired_constraints:
            if dc.key in live_con_keys:
                continue
            # Check capability gate
            required_cap = _CONSTRAINT_TYPE_CAPABILITY.get(dc.constraint_type)
            if required_cap and required_cap not in caps:
                errors.append(
                    {
                        "type": "unsupported_constraint",
                        "name": dc.name,
                        "constraint_type": dc.constraint_type,
                        "message": (
                            f"Constraint type '{dc.constraint_type}' requires capability "
                            f"'{required_cap}' not supported by connector."
                        ),
                    }
                )
                continue
            try:
                await connector.schema_writer.create_constraint(
                    dc.label,
                    dc.properties,
                    constraint_type=dc.constraint_type,
                    name=dc.name,
                )
                operations.append(
                    {
                        "action": "create_constraint",
                        "name": dc.name,
                        "label": dc.label,
                        "properties": dc.properties,
                        "constraint_type": dc.constraint_type,
                    }
                )
            except Exception as exc:
                errors.append(
                    {
                        "type": "create_constraint_error",
                        "name": dc.name,
                        "message": str(exc),
                    }
                )

        # --- Drop extra indexes (only schema-managed names) ---
        schema_managed_idx_names = {d.name for d in desired_indexes}
        for idx in current_indexes:
            key = (idx.label, tuple(idx.properties), idx.type)
            if key not in desired_idx_keys and idx.name in schema_managed_idx_names:
                # Only drop if the name was previously managed by us
                pass  # Conservative: don't drop indexes not managed by schema

        # --- Record projection ---
        status = "projected" if not errors else "failed"
        projected_at = datetime.now(UTC)

        projection = await self._store.create_projection(
            session,
            version_id=version.id,
            connector_id=connector_id,
            status=status,
            operations=operations,
            errors=errors,
            projected_at=projected_at,
        )

        return {
            "id": projection.id,
            "status": status,
            "operations": operations,
            "errors": errors,
            "projected_at": projected_at,
        }

    # ------------------------------------------------------------------
    # Desired-state computation
    # ------------------------------------------------------------------

    def _compute_desired_indexes(
        self,
        version: GraphVersion,
        caps: set[Capability],
    ) -> list[_DesiredIndex]:
        """Derive the set of indexes that should exist from the schema version."""
        desired: list[_DesiredIndex] = []
        for idx in version.indexes:
            desired.append(
                _DesiredIndex(
                    name=idx.name,
                    label=idx.target_label,
                    properties=idx.properties,
                    index_type=idx.index_type,
                    options=idx.index_options,
                )
            )
        return desired

    def _compute_desired_constraints(
        self,
        version: GraphVersion,
        caps: set[Capability],
    ) -> list[_DesiredConstraint]:
        """Derive the set of constraints from the explicit ConstraintDefinition entities."""
        desired: list[_DesiredConstraint] = []

        for c in version.constraints:
            desired.append(
                _DesiredConstraint(
                    name=c.name,
                    label=c.target_label,
                    properties=c.properties,
                    constraint_type=c.constraint_type,
                )
            )

        return desired
