from enum import StrEnum


class QueryLanguage(StrEnum):
    CYPHER = "cypher"
    GREMLIN = "gremlin"


class Capability(StrEnum):
    CYPHER = "cypher"
    GREMLIN = "gremlin"
    VECTOR_SEARCH = "vector_search"
    FULLTEXT_INDEX = "fulltext_index"
    SCHEMA_ENFORCEMENT = "schema_enforcement"
    TRANSACTIONS = "transactions"
