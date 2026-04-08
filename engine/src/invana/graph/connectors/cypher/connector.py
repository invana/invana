"""OpenCypher connector implementation."""

from __future__ import annotations

from typing import Any

from invana.graph.connectors.base.connector import BaseConnector
from invana.graph.connectors.base.constants import Capability
from invana.graph.connectors.base.serializers import BaseSerializer
from invana.graph.connectors.cypher.querysets.algorithms import OpenCypherAlgorithmsQuerySet
from invana.graph.connectors.cypher.querysets.bulk import OpenCypherBulkQuerySet
from invana.graph.connectors.cypher.querysets.data_reader import OpenCypherDataReaderQuerySet
from invana.graph.connectors.cypher.querysets.data_writer import OpenCypherDataWriterQuerySet
from invana.graph.connectors.cypher.querysets.schema_reader import OpenCypherSchemaReaderQuerySet
from invana.graph.connectors.cypher.querysets.schema_writer import OpenCypherSchemaWriterQuerySet
from invana.graph.connectors.cypher.querysets.vector import OpenCypherVectorQuerySet
from invana.graph.connectors.cypher.serializers import OpenCypherSerializer


class OpenCypherConnector(BaseConnector):
    """Concrete openCypher connector with fully working querysets.

    This connector is NOT abstract — it has complete queryset implementations
    using standard openCypher syntax. The only abstract methods left for
    integration packages are: _create_driver(), _close_driver(), execute(),
    health_check() — i.e., the driver lifecycle that requires a vendor-specific
    client library.
    """

    def _create_serializer(self) -> BaseSerializer:
        return OpenCypherSerializer()

    def _init_querysets(self) -> None:
        self.data_reader = OpenCypherDataReaderQuerySet(self)
        self.data_writer = OpenCypherDataWriterQuerySet(self)
        self.schema_reader = OpenCypherSchemaReaderQuerySet(self)
        self.schema_writer = OpenCypherSchemaWriterQuerySet(self)
        self.bulk = OpenCypherBulkQuerySet(self)
        self.algorithms = OpenCypherAlgorithmsQuerySet(self)
        self.vector = OpenCypherVectorQuerySet(self)

    def capabilities(self) -> set[Capability]:
        return {Capability.CYPHER, Capability.TRANSACTIONS}

    # --- These remain abstract — integration packages implement them ---
    async def _create_driver(self) -> Any:
        raise NotImplementedError("Subclass must implement _create_driver()")

    async def _close_driver(self) -> None:
        raise NotImplementedError("Subclass must implement _close_driver()")

    async def execute(self, query: str, parameters: dict | None = None) -> Any:
        raise NotImplementedError("Subclass must implement execute()")

    async def health_check(self) -> bool:
        raise NotImplementedError("Subclass must implement health_check()")
