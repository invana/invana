"""Shared type definitions for the graph module.

This package is the canonical home for all data types, enumerations, and
models used across ``graph/connectors/`` and ``graph/schema/``.  Both
sub-packages import from here — never from each other — which keeps the
dependency graph acyclic::

    graph/types/   ← shared contract (no deps on connectors or schema)
    graph/connectors/  → imports graph/types/
    graph/schema/      → imports graph/types/ and graph/connectors/
"""

from invana.graph.types.constants import Capability, QueryLanguage
from invana.graph.types.data_elements import (
    Edge,
    GraphResponse,
    Path,
    QueryResult,
    ResultMetadata,
    Vertex,
)
from invana.graph.types.filter_types import FilterOp
from invana.graph.types.filters import FilterExpression, FilterGroup, LogicalOp
from invana.graph.types.schema_elements import (
    ConstraintInfo,
    EdgeSchemaInfo,
    EdgeType,
    IndexInfo,
    NodeType,
    PropertyDefinition,
    PropertyInfo,
)
from invana.graph.types.sort import SortDirection, SortSpec

__all__ = [
    "Capability",
    "ConstraintInfo",
    "Edge",
    "EdgeSchemaInfo",
    "EdgeType",
    "FilterExpression",
    "FilterGroup",
    "FilterOp",
    "GraphResponse",
    "IndexInfo",
    "LogicalOp",
    "NodeType",
    "Path",
    "PropertyDefinition",
    "PropertyInfo",
    "QueryLanguage",
    "QueryResult",
    "ResultMetadata",
    "SortDirection",
    "SortSpec",
    "Vertex",
]
