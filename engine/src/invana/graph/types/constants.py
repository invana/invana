"""Connector constants and enumerations."""

from enum import StrEnum


class QueryLanguage(StrEnum):
    """Supported query languages."""

    CYPHER = "cypher"
    GREMLIN = "gremlin"


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
