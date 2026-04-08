from abc import ABC, abstractmethod

from invana.graph.connectors.base.data_types.schema_elements import ConstraintInfo, IndexInfo
from invana.graph.connectors.base.querysets.base import BaseQuerySet


class BaseSchemaReaderQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def get_node_labels(self) -> list[str]: ...

    @abstractmethod
    async def get_edge_labels(self) -> list[str]: ...

    @abstractmethod
    async def get_property_keys(self, label: str) -> list[str]: ...

    @abstractmethod
    async def get_indexes(self) -> list[IndexInfo]: ...

    @abstractmethod
    async def get_constraints(self) -> list[ConstraintInfo]: ...
