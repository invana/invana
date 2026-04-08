from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from invana.graph.connectors.base.connector import BaseConnector
    from invana.graph.connectors.base.serializers import BaseSerializer


class BaseQuerySet:
    def __init__(self, connector: BaseConnector) -> None:
        self._connector = connector

    @property
    def _serializer(self) -> BaseSerializer:
        return self._connector._serializer
