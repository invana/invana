"""Schema element models for ontology definitions, indexes, and constraints.

Canonical definitions live in ``invana.graph.types.schema_elements``.
This module re-exports them for backward compatibility.
"""

from invana.graph.types.schema_elements import (
    ConstraintInfo,
    EdgeSchemaInfo,
    EdgeType,
    IndexInfo,
    NodeType,
    PropertyDefinition,
    PropertyInfo,
)

__all__ = [
    "ConstraintInfo",
    "EdgeSchemaInfo",
    "EdgeType",
    "IndexInfo",
    "NodeType",
    "PropertyDefinition",
    "PropertyInfo",
]
