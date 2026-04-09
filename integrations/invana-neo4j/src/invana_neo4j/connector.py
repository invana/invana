from __future__ import annotations

from invana.graph.connectors.base.constants import Capability
from invana.graph.connectors.cypher.connector import OpenCypherConnector

from invana_neo4j.querysets.algorithms import Neo4jAlgorithmsQuerySet
from invana_neo4j.querysets.schema_reader import Neo4jSchemaReaderQuerySet
from invana_neo4j.querysets.schema_writer import Neo4jSchemaWriterQuerySet


class Neo4jConnector(OpenCypherConnector):
    """Neo4j connector with vendor-specific schema operations and algorithms.

    Extends :class:`OpenCypherConnector` with Neo4j-specific queryset
    implementations for schema management (constraints, indexes, GDS) and
    algorithm support.  The driver lifecycle is inherited from the base class.
    """

    def _init_querysets(self) -> None:
        super()._init_querysets()
        self.schema_reader = Neo4jSchemaReaderQuerySet(self)
        self.schema_writer = Neo4jSchemaWriterQuerySet(self)
        self.algorithms = Neo4jAlgorithmsQuerySet(self)

    def capabilities(self) -> set[Capability]:
        return {
            Capability.CYPHER,
            Capability.TRANSACTIONS,
            Capability.SCHEMA_ENFORCEMENT,
            Capability.FULLTEXT_INDEX,
        }
