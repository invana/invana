"""Schema element models for ontology definitions, indexes, and constraints."""

from typing import Any, Literal

from pydantic import BaseModel


class PropertyInfo(BaseModel):
    """Inferred property schema from existing data.

    Attributes:
        name: Property name.
        inferred_type: Inferred type string.
        sample_values: Up to 5 sample values.
        null_count: How many nodes/edges have this property as null.
        total_count: Total nodes/edges sampled.
    """

    name: str
    inferred_type: str
    sample_values: list[Any] = []
    null_count: int = 0
    total_count: int = 0


class EdgeSchemaInfo(BaseModel):
    """Inferred edge endpoint schema from existing data.

    Attributes:
        name: Edge label name.
        source_labels: Distinct source node labels.
        target_labels: Distinct target node labels.
        property_keys: Property keys found on the edge.
    """

    name: str
    source_labels: list[str]
    target_labels: list[str]
    property_keys: list[str] = []


class PropertyDefinition(BaseModel):
    """Definition of a single property on a node or edge type.

    Attributes:
        name: Property name.
        type: Type string — ``"string"``, ``"integer"``, ``"float"``,
            ``"boolean"``, ``"datetime"``, or ``"list[T]"``.
        required: Whether the property is required.
        unique: Whether the property must be unique.
    """

    name: str
    type: str
    required: bool = False
    unique: bool = False


class NodeType(BaseModel):
    """Ontology definition for a node label.

    Attributes:
        name: Node label name.
        description: Human-readable description.
        properties: Property definitions for this node type.
    """

    name: str
    description: str = ""
    properties: list[PropertyDefinition] = []


class EdgeType(BaseModel):
    """Ontology definition for a relationship type.

    Attributes:
        name: Relationship type name.
        description: Human-readable description.
        source: Source node type name.
        target: Target node type name.
        properties: Property definitions for this edge type.
        cardinality: Relationship cardinality.
    """

    name: str
    description: str = ""
    source: str
    target: str
    properties: list[PropertyDefinition] = []
    cardinality: Literal["one-to-one", "one-to-many", "many-to-many"] = "many-to-many"


class IndexInfo(BaseModel):
    """Information about a database index.

    Attributes:
        name: Index name.
        label: Label the index applies to.
        properties: Indexed property names.
        type: Index type.
    """

    name: str
    label: str
    properties: list[str]
    type: Literal["btree", "range", "fulltext", "vector", "composite", "text", "point", "lookup"]


class ConstraintInfo(BaseModel):
    """Information about a database constraint.

    Attributes:
        name: Constraint name.
        label: Label the constraint applies to.
        properties: Constrained property names.
        type: Constraint type.
    """

    name: str
    label: str
    properties: list[str]
    type: Literal["unique", "exists", "node_key", "relationship_unique", "relationship_exists"]
