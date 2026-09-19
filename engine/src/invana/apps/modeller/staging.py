"""The staged set — what a draft has changed since the version it will replace.

The draft *is* the staged set (docs/for-developers/modules/connect-and-model/features/model-editor.md
ME2, ME4). Nothing is written to a side table: a change reaches a published version
only at the commit, and until then it lives in the draft, which is why it survives
a reload and is visible to anyone who opens the model.

So this module does not record anything. It reads the diff between the active
version and the draft, and names each difference as one staged change with a
stable id — stable enough to discard by (ME4), and stable across reloads because
it is derived from the names, not from a row.

Discarding one change puts that one element back the way the active version has
it. Discarding everything rebuilds the draft from the active version.
"""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING, Any, Literal

from pydantic import BaseModel

from invana.apps.modeller.models import GraphVersion
from invana.apps.modeller.schemas import EdgeTypeDiff, NodeTypeDiff
from invana.apps.modeller.versioner import compute_diff

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.apps.modeller.store import ModelStore

StagedOp = Literal["added", "removed", "modified"]
StagedKind = Literal["node_type", "edge_type", "property_key", "constraint", "index"]

# The order the staged bar lists them in: what a person drew first, first.
_KIND_ORDER = ("node_type", "edge_type", "property_key", "constraint", "index")


class StagedChange(BaseModel):
    """One difference between the draft and the version it replaces."""

    id: str
    op: StagedOp
    kind: StagedKind
    name: str
    # For a modification: field → [was, now]. A type whose property mappings moved
    # names them under `added_property_mappings` / `removed_property_mappings`
    # instead — there is no "was" for a set of names. Empty for an add or a remove.
    changes: dict[str, list[Any]] = {}
    # Named dependents, when discarding or committing this would take something
    # else with it (model-editor.md — "a staged delete with dependents").
    dependents: list[str] = []


class StagedSet(BaseModel):
    """Everything staged on a draft, and whether it can commit."""

    version_id: str
    based_on: str | None = None
    count: int = 0
    changes: list[StagedChange] = []
    can_commit: bool = False
    # Why not, when it cannot. The commit action says this rather than being
    # silently disabled.
    reason: str | None = None


def _change_id(kind: str, op: str, name: str) -> str:
    return f"{kind}:{op}:{name}"


def _type_fields(item: NodeTypeDiff | EdgeTypeDiff) -> dict[str, Any]:
    """What changed on a modified node or edge type, as `StagedChange.changes`.

    A type diff carries three fields — the property mappings added, the ones
    removed, and the metadata that moved — not one `changes` dict the way a
    property-key diff does. Reading `.changes` off it raised `AttributeError`
    and the whole staged set answered 500, so a model with an edited type could
    not open its panel at all.

    Metadata keeps the field → [was, now] shape. Property mappings cannot: a set
    of names has no "was", so they are listed under their own two keys.
    """
    fields: dict[str, Any] = dict(item.metadata_changes)
    if item.added_property_mappings:
        fields["added_property_mappings"] = item.added_property_mappings
    if item.removed_property_mappings:
        fields["removed_property_mappings"] = item.removed_property_mappings
    return fields


def _dependents_of_removed_node_type(draft: GraphVersion, name: str) -> list[str]:
    """Edge types in the draft that still name a removed node type as an endpoint."""
    hits: list[str] = []
    for et in draft.edge_types:
        endpoints = list(et.source_node_types or []) + list(et.target_node_types or [])
        if name in endpoints:
            hits.append(f"edge type {et.name}")
    return hits


def collect(active: GraphVersion | None, draft: GraphVersion) -> StagedSet:
    """The staged set for *draft* against the version it will replace.

    With no active version, every element in the draft is staged: the first
    publish stages the whole model.
    """
    if active is None:
        changes = [
            StagedChange(id=_change_id("node_type", "added", nt.name), op="added", kind="node_type", name=nt.name)
            for nt in draft.node_types
        ] + [
            StagedChange(id=_change_id("edge_type", "added", et.name), op="added", kind="edge_type", name=et.name)
            for et in draft.edge_types
        ]
        return StagedSet(
            version_id=draft.id,
            count=len(changes),
            changes=changes,
            can_commit=bool(changes),
            reason=None if changes else "Nothing to commit — this draft is empty.",
        )

    diff = compute_diff(active, draft)
    changes: list[StagedChange] = []

    def add(kind: StagedKind, op: StagedOp, name: str, fields: dict[str, Any] | None = None) -> None:
        changes.append(
            StagedChange(
                id=_change_id(kind, op, name),
                op=op,
                kind=kind,
                name=name,
                changes={k: list(v) for k, v in (fields or {}).items()},
                dependents=_dependents_of_removed_node_type(draft, name)
                if (kind == "node_type" and op == "removed")
                else [],
            )
        )

    for name in diff.added_node_types:
        add("node_type", "added", name)
    for name in diff.removed_node_types:
        add("node_type", "removed", name)
    for item in diff.modified_node_types:
        add("node_type", "modified", item.name, _type_fields(item))

    for name in diff.added_edge_types:
        add("edge_type", "added", name)
    for name in diff.removed_edge_types:
        add("edge_type", "removed", name)
    for item in diff.modified_edge_types:
        add("edge_type", "modified", item.name, _type_fields(item))

    for name in diff.added_property_keys:
        add("property_key", "added", name)
    for name in diff.removed_property_keys:
        add("property_key", "removed", name)
    for item in diff.modified_property_keys:
        add("property_key", "modified", item.name, item.changes)

    for name in diff.added_constraints:
        add("constraint", "added", name)
    for name in diff.removed_constraints:
        add("constraint", "removed", name)
    for name in diff.added_indexes:
        add("index", "added", name)
    for name in diff.removed_indexes:
        add("index", "removed", name)

    changes.sort(key=lambda c: (_KIND_ORDER.index(c.kind), c.op, c.name))
    return StagedSet(
        version_id=draft.id,
        based_on=active.version,
        count=len(changes),
        changes=changes,
        can_commit=bool(changes),
        reason=None if changes else "Nothing to commit — this draft matches the published version.",
    )


# ---------------------------------------------------------------------------
# Discard
# ---------------------------------------------------------------------------


class UnknownChange(ValueError):
    """The id names no staged change — usually a stale bar after someone else committed."""


async def discard_all(session: AsyncSession, store: ModelStore, *, active: GraphVersion, draft: GraphVersion) -> None:
    """Put the draft back to the active version, wholesale."""
    reloaded = await store.get_version(session, draft.id)
    if reloaded is None:
        return
    for collection in (
        reloaded.node_types,
        reloaded.edge_types,
        reloaded.constraints,
        reloaded.indexes,
        reloaded.property_keys,
    ):
        for element in list(collection):
            await session.delete(element)
    await session.flush()
    await store.clone_version_contents(session, active, reloaded)
    await session.flush()


async def discard_one(
    session: AsyncSession,
    store: ModelStore,
    *,
    active: GraphVersion,
    draft: GraphVersion,
    change_id: str,
) -> StagedChange:
    """Put one element back the way the active version has it."""
    staged = collect(active, draft)
    change = next((c for c in staged.changes if c.id == change_id), None)
    if change is None:
        raise UnknownChange(change_id)

    if change.op == "added":
        await _delete_element(session, draft, change.kind, change.name)
    else:
        # ``removed`` and ``modified`` both resolve the same way: drop whatever the
        # draft has under that name, then clone the active version's copy back in.
        await _delete_element(session, draft, change.kind, change.name)
        await _clone_element(session, store, active=active, draft=draft, kind=change.kind, name=change.name)
    await session.flush()
    return change


def _element(version: GraphVersion, kind: str, name: str) -> Any:
    collection = {
        "node_type": version.node_types,
        "edge_type": version.edge_types,
        "property_key": version.property_keys,
        "constraint": version.constraints,
        "index": version.indexes,
    }[kind]
    return next((e for e in collection if e.name == name), None)


async def _delete_element(session: AsyncSession, version: GraphVersion, kind: str, name: str) -> None:
    element = _element(version, kind, name)
    if element is not None:
        await session.delete(element)
        await session.flush()


async def _clone_element(
    session: AsyncSession,
    store: ModelStore,
    *,
    active: GraphVersion,
    draft: GraphVersion,
    kind: str,
    name: str,
) -> None:
    source = _element(active, kind, name)
    if source is None:
        return

    if kind == "property_key":
        await store.create_property_key(
            session,
            version_id=draft.id,
            name=source.name,
            type=source.type,
            value_cardinality=source.value_cardinality,
            description=source.description,
            validation_rules=[
                {"rule_type": r.rule_type, "params": copy.deepcopy(r.params)} for r in source.validation_rules
            ],
        )
        return

    if kind in {"node_type", "edge_type"}:
        mappings = [
            {
                "property_key": m.property_key.name,
                "default_value": m.default_value,
                "sort_order": m.sort_order,
                "validation_rules": [
                    {"rule_type": r.rule_type, "params": copy.deepcopy(r.params)} for r in m.validation_rules
                ],
            }
            for m in source.property_mappings
        ]
        if kind == "node_type":
            await store.create_node_type(
                session,
                version_id=draft.id,
                name=source.name,
                description=source.description,
                parent_type=source.parent_type,
                is_abstract=source.is_abstract,
                validation_mode=source.validation_mode,
                property_mappings=mappings,
            )
        else:
            await store.create_edge_type(
                session,
                version_id=draft.id,
                name=source.name,
                description=source.description,
                source_node_types=copy.deepcopy(source.source_node_types),
                target_node_types=copy.deepcopy(source.target_node_types),
                multiplicity=source.multiplicity,
                property_mappings=mappings,
            )
        return

    if kind == "constraint":
        await store.create_constraint(
            session,
            version_id=draft.id,
            name=source.name,
            target_kind=source.target_kind,
            target_label=source.target_label,
            constraint_type=source.constraint_type,
            properties=copy.deepcopy(source.properties),
        )
        return

    await store.create_index(
        session,
        version_id=draft.id,
        name=source.name,
        target_kind=source.target_kind,
        target_label=source.target_label,
        properties=copy.deepcopy(source.properties),
        index_type=source.index_type,
        index_options=copy.deepcopy(source.index_options) if source.index_options else None,
    )
