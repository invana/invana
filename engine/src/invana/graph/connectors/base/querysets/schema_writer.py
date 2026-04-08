from abc import ABC, abstractmethod
from typing import Literal

from invana.graph.connectors.base.querysets.base import BaseQuerySet


class BaseSchemaWriterQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def create_index(
        self,
        label: str,
        properties: list[str],
        *,
        index_type: Literal["btree", "fulltext", "composite"] = "btree",
        name: str | None = None,
    ) -> None: ...

    @abstractmethod
    async def drop_index(self, name: str) -> None: ...

    @abstractmethod
    async def create_constraint(
        self,
        label: str,
        properties: list[str],
        *,
        constraint_type: Literal["unique", "exists", "node_key"] = "unique",
        name: str | None = None,
    ) -> None: ...

    @abstractmethod
    async def drop_constraint(self, name: str) -> None: ...
