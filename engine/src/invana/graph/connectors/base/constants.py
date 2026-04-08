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
