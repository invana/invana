"""Base connector abstract class."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from invana.graph.connectors.base.querysets.algorithms import BaseAlgorithmsQuerySet
from invana.graph.connectors.base.querysets.bulk import BaseBulkQuerySet
from invana.graph.connectors.base.querysets.data_reader import BaseDataReaderQuerySet
from invana.graph.connectors.base.querysets.data_writer import BaseDataWriterQuerySet
from invana.graph.connectors.base.querysets.schema_reader import BaseSchemaReaderQuerySet
from invana.graph.connectors.base.querysets.schema_writer import BaseSchemaWriterQuerySet
from invana.graph.connectors.base.querysets.vector import BaseVectorQuerySet
from invana.graph.connectors.base.serializers import BaseSerializer
from invana.graph.types.constants import Capability


class BaseConnector(ABC):
    """Base connector for all graph databases.

    Access: connector.<queryset>.<method>()
    Lifecycle: async context manager or explicit connect()/disconnect().
    """

    data_reader: BaseDataReaderQuerySet
    data_writer: BaseDataWriterQuerySet
    schema_reader: BaseSchemaReaderQuerySet
    schema_writer: BaseSchemaWriterQuerySet
    bulk: BaseBulkQuerySet
    algorithms: BaseAlgorithmsQuerySet
    vector: BaseVectorQuerySet | None

    def __init__(self, uri: str, *, pool_size: int = 10, **kwargs: Any) -> None:
        self._uri = uri
        self._pool_size = pool_size
        self._driver: Any = None
        self._connected: bool = False
        self._serializer = self._create_serializer()
        self._init_querysets()

    @abstractmethod
    def _create_serializer(self) -> BaseSerializer: ...

    @abstractmethod
    def _init_querysets(self) -> None:
        """Wire up self.data_reader, self.data_writer, self.schema_reader, etc."""

    # --- These 4 are what integration packages implement ---
    @abstractmethod
    async def _create_driver(self) -> Any:
        """Create the vendor-specific driver instance."""

    @abstractmethod
    async def _close_driver(self) -> None:
        """Close the vendor-specific driver."""

    @abstractmethod
    async def execute(self, query: str, parameters: dict | None = None) -> Any:
        """Execute a raw query via the vendor driver."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Verify the connection is alive."""

    # --- End of integration-implemented methods ---

    @abstractmethod
    def capabilities(self) -> set[Capability]:
        """Return the set of capabilities supported by this connector."""

    async def connect(self) -> None:
        """Create the driver and verify connectivity."""
        self._driver = await self._create_driver()
        self._connected = True
        await self.health_check()

    async def disconnect(self) -> None:
        """Close the driver and mark the connector as disconnected."""
        if self._driver:
            await self._close_driver()
            self._connected = False

    async def __aenter__(self) -> BaseConnector:
        await self.connect()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.disconnect()
