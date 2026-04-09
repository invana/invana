"""Inheritance resolver — computes effective properties for child node types.

Rules:
- Single inheritance only (``parent_type`` field).
- Child inherits all parent properties and their validation rules.
- Child can add new properties but cannot remove or change type of inherited ones.
- Inherited validation rules cannot be relaxed; child can add stricter rules.
- Depth limit: 5 levels maximum.
- Abstract types cannot be instantiated.
- Edges accepting a parent type also accept child types (Liskov substitution).
"""

from __future__ import annotations

import copy

from invana.modeller.models import NodeTypeDefinition, PropertyDefinition

MAX_INHERITANCE_DEPTH = 5


class InheritanceCycleError(Exception):
    """Raised when a circular inheritance chain is detected."""


class InheritanceDepthError(Exception):
    """Raised when an inheritance chain exceeds the maximum allowed depth."""


def build_hierarchy(
    node_type: NodeTypeDefinition,
    type_map: dict[str, NodeTypeDefinition],
) -> list[str]:
    """Return the parent chain from root to *node_type* (inclusive).

    Raises ``InheritanceCycleError`` on cycles and
    ``InheritanceDepthError`` when depth exceeds ``MAX_INHERITANCE_DEPTH``.
    """
    chain: list[str] = []
    seen: set[str] = set()
    current: NodeTypeDefinition | None = node_type

    while current is not None:
        if current.name in seen:
            msg = f"Inheritance cycle detected: {' -> '.join(chain)} -> {current.name}"
            raise InheritanceCycleError(msg)
        seen.add(current.name)
        chain.append(current.name)
        if len(chain) > MAX_INHERITANCE_DEPTH:
            msg = f"Inheritance depth exceeds {MAX_INHERITANCE_DEPTH}: {' -> '.join(chain)}"
            raise InheritanceDepthError(msg)
        if current.parent_type is None:
            break
        current = type_map.get(current.parent_type)
        if current is None and node_type.parent_type is not None:
            msg = f"Parent type '{node_type.parent_type}' not found for '{node_type.name}'"
            raise ValueError(msg)

    chain.reverse()
    return chain


def resolve_effective_properties(
    node_type: NodeTypeDefinition,
    type_map: dict[str, NodeTypeDefinition],
) -> list[PropertyDefinition]:
    """Compute the full set of properties for *node_type*, including inherited ones.

    Returns a new list where inherited properties appear first (in parent order),
    followed by the type's own properties. Inherited ``PropertyDefinition`` objects
    are shallow copies with the ``id`` preserved for rule lookups.
    """
    hierarchy = build_hierarchy(node_type, type_map)
    seen_names: set[str] = set()
    effective: list[PropertyDefinition] = []

    for type_name in hierarchy:
        nt = type_map[type_name]
        for prop in nt.properties:
            if prop.name not in seen_names:
                if nt is node_type:
                    effective.append(prop)
                else:
                    # Shallow copy for an inherited property
                    inherited = copy.copy(prop)
                    effective.append(inherited)
                seen_names.add(prop.name)

    return effective


def get_subtypes(
    type_name: str,
    type_map: dict[str, NodeTypeDefinition],
) -> set[str]:
    """Return all transitive subtypes of *type_name* (not including itself)."""
    subtypes: set[str] = set()
    for nt in type_map.values():
        if nt.name == type_name:
            continue
        try:
            chain = build_hierarchy(nt, type_map)
        except (InheritanceCycleError, InheritanceDepthError, ValueError):
            continue
        if type_name in chain:
            subtypes.add(nt.name)
    return subtypes


def build_type_map(node_types: list[NodeTypeDefinition]) -> dict[str, NodeTypeDefinition]:
    """Build a name → NodeTypeDefinition lookup from a list of types."""
    return {nt.name: nt for nt in node_types}
