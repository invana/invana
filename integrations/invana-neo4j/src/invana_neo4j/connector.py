from __future__ import annotations

from invana.graph.connectors.cypher.connector import CYPHER_PROFILE, OpenCypherConnector
from invana.graph.types.capabilities import Supports, Version, always
from invana.graph.types.constants import Capability

from invana_neo4j.querysets.algorithms import Neo4jAlgorithmsQuerySet
from invana_neo4j.querysets.schema_reader import Neo4jSchemaReaderQuerySet
from invana_neo4j.querysets.schema_writer import Neo4jSchemaWriterQuerySet

# Neo4j capability profile (RFC-022) — extends the openCypher baseline with Neo4j's
# tested version window and vendor feature flags. Bumping ``tested_max`` is how a newly
# validated Neo4j release stops being reported as UNTESTED.
NEO4J_PROFILE = CYPHER_PROFILE.merge(
    min_version=Version(4, 0),
    tested_max=Version(5, 26),
    features={
        Capability.SCHEMA_ENFORCEMENT: always(),
        Capability.FULLTEXT_INDEX: always(),
        Capability.COMPOSITE_INDEX: always(),
        Capability.POINT_INDEX: Supports(since=Version(5, 0)),
        Capability.VECTOR_SEARCH: Supports(since=Version(5, 11)),
    },
)


class Neo4jConnector(OpenCypherConnector):
    """Neo4j connector with vendor-specific schema operations and algorithms.

    Extends :class:`OpenCypherConnector` with Neo4j-specific queryset
    implementations for schema management (constraints, indexes, GDS) and
    algorithm support.  The driver lifecycle is inherited from the base class.
    """

    _capability_profile = NEO4J_PROFILE

    def _init_querysets(self) -> None:
        super()._init_querysets()
        self.schema_reader = Neo4jSchemaReaderQuerySet(self)
        self.schema_writer = Neo4jSchemaWriterQuerySet(self)
        self.algorithms = Neo4jAlgorithmsQuerySet(self)
