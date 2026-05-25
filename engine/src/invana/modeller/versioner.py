"""Versioner — manages draft→active→archived lifecycle and computes diffs.

Responsibilities:
- Activate a draft version (assign SemVer, archive the previous active).
- Compute ``SchemaDiff`` between two versions.
- Auto-classify diffs as major / minor / patch.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import update

from invana.modeller.models import (
    ConstraintDefinition,
    EdgeTypeDefinition,
    GraphVersion,
    IndexDefinition,
    NodeTypeDefinition,
    PropertyKeyDefinition,
)
from invana.modeller.schemas import (
    EdgeTypeDiff,
    NodeTypeDiff,
    PropertyKeyDiff,
    SchemaDiff,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.modeller.store import ModelStore


# ---------------------------------------------------------------------------
# Diffing helpers
# ---------------------------------------------------------------------------

_PROPERTY_KEY_DIFF_FIELDS = ("type", "value_cardinality", "description")
_NODE_META_FIELDS = ("description", "parent_type", "is_abstract", "validation_mode")
_EDGE_META_FIELDS = ("description", "source_node_types", "target_node_types", "multiplicity")


def _diff_property_keys(
    old_keys: list[PropertyKeyDefinition],
    new_keys: list[PropertyKeyDefinition],
) -> tuple[list[str], list[str], list[PropertyKeyDiff]]:
    old_map = {pk.name: pk for pk in old_keys}
    new_map = {pk.name: pk for pk in new_keys}

    added = [n for n in new_map if n not in old_map]
    removed = [n for n in old_map if n not in new_map]

    modified: list[PropertyKeyDiff] = []
    for name, old_item in old_map.items():
        if name not in new_map:
            continue
        changes: dict[str, tuple[Any, Any]] = {}
        for field in _PROPERTY_KEY_DIFF_FIELDS:
            old_val = getattr(old_item, field)
            new_val = getattr(new_map[name], field)
            if old_val != new_val:
                changes[field] = (old_val, new_val)
        if changes:
            modified.append(PropertyKeyDiff(name=name, changes=changes))

    return added, removed, modified


def _diff_type_mappings(
    old_type: NodeTypeDefinition | EdgeTypeDefinition,
    new_type: NodeTypeDefinition | EdgeTypeDefinition,
) -> tuple[list[str], list[str]]:
    """Diff property mappings between two type definitions.

    Returns (added_mapping_names, removed_mapping_names) where names are
    the property key names used in each mapping.
    """
    old_names = {m.property_key.name for m in old_type.property_mappings}
    new_names = {m.property_key.name for m in new_type.property_mappings}

    added = sorted(new_names - old_names)
    removed = sorted(old_names - new_names)
    return added, removed


def _diff_node_types(
    old_types: list[NodeTypeDefinition],
    new_types: list[NodeTypeDefinition],
) -> tuple[list[str], list[str], list[NodeTypeDiff]]:
    old_map = {nt.name: nt for nt in old_types}
    new_map = {nt.name: nt for nt in new_types}

    added = [n for n in new_map if n not in old_map]
    removed = [n for n in old_map if n not in new_map]

    modified: list[NodeTypeDiff] = []
    for name, old_item in old_map.items():
        if name not in new_map:
            continue
        added_m, removed_m = _diff_type_mappings(old_item, new_map[name])
        meta: dict[str, tuple[Any, Any]] = {}
        for field in _NODE_META_FIELDS:
            old_val = getattr(old_item, field)
            new_val = getattr(new_map[name], field)
            if old_val != new_val:
                meta[field] = (old_val, new_val)
        if added_m or removed_m or meta:
            modified.append(
                NodeTypeDiff(
                    name=name,
                    added_property_mappings=added_m,
                    removed_property_mappings=removed_m,
                    metadata_changes=meta,
                )
            )

    return added, removed, modified


def _diff_edge_types(
    old_types: list[EdgeTypeDefinition],
    new_types: list[EdgeTypeDefinition],
) -> tuple[list[str], list[str], list[EdgeTypeDiff]]:
    old_map = {et.name: et for et in old_types}
    new_map = {et.name: et for et in new_types}

    added = [n for n in new_map if n not in old_map]
    removed = [n for n in old_map if n not in new_map]

    modified: list[EdgeTypeDiff] = []
    for name, old_item in old_map.items():
        if name not in new_map:
            continue
        added_m, removed_m = _diff_type_mappings(old_item, new_map[name])
        meta: dict[str, tuple[Any, Any]] = {}
        for field in _EDGE_META_FIELDS:
            old_val = getattr(old_item, field)
            new_val = getattr(new_map[name], field)
            if old_val != new_val:
                meta[field] = (old_val, new_val)
        if added_m or removed_m or meta:
            modified.append(
                EdgeTypeDiff(
                    name=name,
                    added_property_mappings=added_m,
                    removed_property_mappings=removed_m,
                    metadata_changes=meta,
                )
            )

    return added, removed, modified


def _diff_constraints(
    old_constraints: list[ConstraintDefinition],
    new_constraints: list[ConstraintDefinition],
) -> tuple[list[str], list[str]]:
    old_names = {c.name for c in old_constraints}
    new_names = {c.name for c in new_constraints}
    return sorted(new_names - old_names), sorted(old_names - new_names)


def _diff_indexes(
    old_indexes: list[IndexDefinition],
    new_indexes: list[IndexDefinition],
) -> tuple[list[str], list[str]]:
    old_names = {idx.name for idx in old_indexes}
    new_names = {idx.name for idx in new_indexes}
    return sorted(new_names - old_names), sorted(old_names - new_names)


def _classify(diff: SchemaDiff) -> str:
    """Auto-classify a diff as major, minor, or patch."""
    # Major: anything removed, or a type change on a property key
    if diff.removed_node_types or diff.removed_edge_types or diff.removed_property_keys:
        return "major"

    # Removing constraints is a schema change but not necessarily breaking
    # However, removing property keys used by types is breaking
    for pk_diff in diff.modified_property_keys:
        if "type" in pk_diff.changes:
            return "major"

    for nt_diff in diff.modified_node_types:
        if nt_diff.removed_property_mappings:
            return "major"

    for et_diff in diff.modified_edge_types:
        if et_diff.removed_property_mappings:
            return "major"

    # Minor: anything added
    if (
        diff.added_node_types
        or diff.added_edge_types
        or diff.added_indexes
        or diff.added_property_keys
        or diff.added_constraints
    ):
        return "minor"

    for nt_diff in diff.modified_node_types:
        if nt_diff.added_property_mappings:
            return "minor"
    for et_diff in diff.modified_edge_types:
        if et_diff.added_property_mappings:
            return "minor"

    return "patch"


def compute_diff(old: GraphVersion, new: GraphVersion) -> SchemaDiff:
    """Compute the diff between two fully-loaded ``GraphVersion`` objects."""
    added_pk, removed_pk, modified_pk = _diff_property_keys(old.property_keys, new.property_keys)
    added_nt, removed_nt, modified_nt = _diff_node_types(old.node_types, new.node_types)
    added_et, removed_et, modified_et = _diff_edge_types(old.edge_types, new.edge_types)
    added_con, removed_con = _diff_constraints(old.constraints, new.constraints)
    added_idx, removed_idx = _diff_indexes(old.indexes, new.indexes)

    diff = SchemaDiff(
        added_property_keys=added_pk,
        removed_property_keys=removed_pk,
        modified_property_keys=modified_pk,
        added_node_types=added_nt,
        removed_node_types=removed_nt,
        modified_node_types=modified_nt,
        added_edge_types=added_et,
        removed_edge_types=removed_et,
        modified_edge_types=modified_et,
        added_constraints=added_con,
        removed_constraints=removed_con,
        added_indexes=added_idx,
        removed_indexes=removed_idx,
    )
    diff.classification = _classify(diff)
    return diff


# ---------------------------------------------------------------------------
# SemVer helpers
# ---------------------------------------------------------------------------


def _parse_semver(version: str) -> tuple[int, int, int]:
    parts = version.split(".")
    if len(parts) != 3:
        msg = f"Invalid SemVer: {version}"
        raise ValueError(msg)
    return int(parts[0]), int(parts[1]), int(parts[2])


def _bump(current: str | None, classification: str) -> str:
    """Compute the next SemVer string from the current version and classification."""
    if current is None:
        return "1.0.0"
    major, minor, patch = _parse_semver(current)
    if classification == "major":
        return f"{major + 1}.0.0"
    if classification == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


# ---------------------------------------------------------------------------
# Versioner
# ---------------------------------------------------------------------------


class Versioner:
    """Manages the draft → active → archived version lifecycle."""

    def __init__(self, store: ModelStore) -> None:
        self._store = store

    async def activate(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        override_version: str | None = None,
        change_summary: str = "",
    ) -> GraphVersion:
        """Activate a draft version.

        1. Compute diff against the current active version (if exists).
        2. Auto-classify and bump SemVer (or use ``override_version``).
        3. Archive the current active version.
        4. Mark the draft as active.

        Returns the activated ``GraphVersion`` with version number assigned.
        """
        draft = await self._store.get_version(session, version_id)
        if draft is None:
            msg = f"Version {version_id} not found."
            raise ValueError(msg)
        if draft.status != "draft":
            msg = f"Version {version_id} is not a draft (status={draft.status})."
            raise ValueError(msg)

        # Find current active version for diffing
        current_active = await self._store.get_active_version(session, draft.model_id)

        if override_version is not None:
            semver = override_version
        elif current_active is not None:
            diff = compute_diff(current_active, draft)
            semver = _bump(current_active.version, diff.classification)
        else:
            semver = "1.0.0"

        # Archive the current active version
        if current_active is not None:
            await session.execute(
                update(GraphVersion).where(GraphVersion.id == current_active.id).values(status="archived")
            )

        # Activate the draft
        now = datetime.now(UTC)
        await session.execute(
            update(GraphVersion)
            .where(GraphVersion.id == version_id)
            .values(
                status="active",
                version=semver,
                change_summary=change_summary,
                activated_at=now,
            )
        )

        await session.flush()

        # Re-fetch to return the updated object
        return await self._store.get_version(session, version_id)

    async def diff(
        self,
        session: AsyncSession,
        *,
        model_id: str,
        from_version: str,
        to_version: str,
    ) -> SchemaDiff:
        """Compute the diff between two named versions."""
        old = await self._store.get_version_by_semver(session, model_id, from_version)
        if old is None:
            msg = f"Version '{from_version}' not found."
            raise ValueError(msg)
        new = await self._store.get_version_by_semver(session, model_id, to_version)
        if new is None:
            msg = f"Version '{to_version}' not found."
            raise ValueError(msg)
        return compute_diff(old, new)
