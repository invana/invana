"""Connector constants and enumerations."""

from enum import StrEnum


class QueryLanguage(StrEnum):
    """Supported query languages."""

    CYPHER = "cypher"
    GREMLIN = "gremlin"


class PropertyType(StrEnum):
    """Canonical property/data types a graph model may use (RFC-022).

    The superset across all backends and versions. Each connector advertises the
    subset it supports for the detected server version via its ``CapabilityProfile``;
    the connector owns the canonical→native mapping at projection time.

    Three tiers:
    - **Universal** — every backend stores these natively.
    - **Semantic overlays** — engine-enforced, stored as a native string/text value,
      so they are available on *every* backend regardless of version.
    - **Native temporal/spatial + containers** — genuinely backend/version dependent.
    """

    # Universal
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    # Semantic overlays (always available — stored as native string/text)
    ENUM = "enum"
    UUID = "uuid"
    JSON = "json"
    # Native temporal / spatial
    DATE = "date"
    TIME = "time"
    DATETIME = "datetime"
    DURATION = "duration"
    POINT = "point"
    # Containers / cardinality
    LIST = "list"
    SET = "set"
    MAP = "map"


# Semantic overlays are available on every backend (stored as native string/text),
# independent of the connected database or its version.
SEMANTIC_OVERLAY_TYPES: frozenset[PropertyType] = frozenset({PropertyType.ENUM, PropertyType.UUID, PropertyType.JSON})


class Capability(StrEnum):
    """Capabilities that a connector may advertise."""

    CYPHER = "cypher"
    GREMLIN = "gremlin"
    VECTOR_SEARCH = "vector_search"
    FULLTEXT_INDEX = "fulltext_index"
    SCHEMA_ENFORCEMENT = "schema_enforcement"
    TRANSACTIONS = "transactions"
    COMPOSITE_INDEX = "composite_index"
    TEXT_INDEX = "text_index"
    POINT_INDEX = "point_index"
    LOOKUP_INDEX = "lookup_index"
    PROPERTY_CARDINALITY = "property_cardinality"
    RELATIONSHIP_PROPERTY_CONSTRAINTS = "relationship_property_constraints"
    RELATIONSHIP_UNIQUENESS = "relationship_uniqueness"
