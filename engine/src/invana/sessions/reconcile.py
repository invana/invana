"""Reconcile an LLM model proposal into a draft version (RFC-031 Decision 4).

Conservative, by-name diff: create property keys / node types / edge types that
don't yet exist, and *add* properties (and edge endpoints) to those that do —
**never delete** a type or property the user didn't ask to remove. Ordering is
load-bearing: property keys first (node/edge types reference them by name), then
node types (edge endpoints reference node-type names), then edge types.

The caller passes the eager-loaded draft ``version`` (``ModelStore.get_version``)
and a validated :class:`~invana.llm.propose.ModelProposal` — referential
integrity is already checked (``validate_proposal``) before we touch the draft.
All ``ModelStore`` writes are draft-guarded by ``_ensure_draft``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from invana.modeller.store import ModelStore

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.llm.propose import ModelProposal
    from invana.modeller.models import GraphVersion


def _mappings(names: list[str]) -> list[dict]:
    """Property-key names → ModelStore property_mappings dicts (resolved by name)."""
    return [{"property_key": name, "sort_order": i} for i, name in enumerate(names)]


def _merge(existing: list[str], incoming: list[str]) -> list[str]:
    """Order-preserving union — keeps existing entries, appends genuinely new ones."""
    out: list[str] = []
    for name in [*existing, *incoming]:
        if name not in out:
            out.append(name)
    return out


async def reconcile_proposal(
    session: AsyncSession,
    *,
    store: ModelStore,
    version: GraphVersion,
    proposal: ModelProposal,
) -> dict[str, int]:
    """Apply ``proposal`` to ``version`` (a draft). Returns counts of *new* types/keys."""
    existing_pk_names = {pk.name for pk in version.property_keys}
    existing_node = {nt.name: nt for nt in version.node_types}
    existing_edge = {et.name: et for et in version.edge_types}

    counts = {"node_types": 0, "edge_types": 0, "property_keys": 0}

    # 1. Collect every referenced property key (name → type, first-seen wins) and
    #    create the ones not already present.
    referenced: dict[str, str] = {}
    for owner in (*proposal.node_types, *proposal.edge_types):
        for pk in owner["property_keys"]:
            referenced.setdefault(pk["name"], pk["type"])
    for name, ptype in referenced.items():
        if name not in existing_pk_names:
            await store.create_property_key(session, version_id=version.id, name=name, type=ptype)
            existing_pk_names.add(name)
            counts["property_keys"] += 1

    # 2. Node types — create new ones; for existing ones, add any new properties
    #    (union — never drop a property the user already has).
    for nt in proposal.node_types:
        prop_names = [pk["name"] for pk in nt["property_keys"]]
        current = existing_node.get(nt["name"])
        if current is None:
            await store.create_node_type(
                session,
                version_id=version.id,
                name=nt["name"],
                description=nt["description"],
                property_mappings=_mappings(prop_names),
            )
            counts["node_types"] += 1
        else:
            current_props = [m.property_key.name for m in current.property_mappings]
            merged = _merge(current_props, prop_names)
            if set(merged) != set(current_props):
                await store.update_node_type(session, current.id, property_mappings=_mappings(merged))

    # 3. Edge types — create new ones; for existing ones, union properties +
    #    endpoints.
    for et in proposal.edge_types:
        prop_names = [pk["name"] for pk in et["property_keys"]]
        current = existing_edge.get(et["name"])
        if current is None:
            await store.create_edge_type(
                session,
                version_id=version.id,
                name=et["name"],
                description=et["description"],
                source_node_types=et["source_node_types"],
                target_node_types=et["target_node_types"],
                property_mappings=_mappings(prop_names),
            )
            counts["edge_types"] += 1
        else:
            updates: dict[str, object] = {}
            current_props = [m.property_key.name for m in current.property_mappings]
            merged = _merge(current_props, prop_names)
            if set(merged) != set(current_props):
                updates["property_mappings"] = _mappings(merged)
            new_src = _merge(current.source_node_types or [], et["source_node_types"])
            if set(new_src) != set(current.source_node_types or []):
                updates["source_node_types"] = new_src
            new_tgt = _merge(current.target_node_types or [], et["target_node_types"])
            if set(new_tgt) != set(current.target_node_types or []):
                updates["target_node_types"] = new_tgt
            if updates:
                await store.update_edge_type(session, current.id, **updates)

    return counts
