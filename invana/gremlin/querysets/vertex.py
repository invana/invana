from __future__ import annotations
from typing import TYPE_CHECKING
from .base import GremlinQuerySetBase
from invana.base.querysets.graph import VertexCRUDQuerySetBase
import abc
from ..resultsets import GremlinQueryResultSet



class GremlinVertexQuerySet(GremlinQuerySetBase, VertexCRUDQuerySetBase, abc.ABC):

    def create(self, label, **properties) -> GremlinQueryResultSet:
        return GremlinQueryResultSet(self.connector.g.create_vertex(label, **properties))

    def search(self, **search_kwarg) -> GremlinQueryResultSet:
        return GremlinQueryResultSet(self.connector.g.V().search(**search_kwarg))

    def delete(self, **search_kwarg):
        return self.search(**search_kwarg).drop()

    def get_or_create(self, label, **properties):
        elem = self.search(has__label=label, **self.create_has_filters(**properties)) \
            .to_list()
        created = False
        if elem.__len__() == 0:
            elem = self.create(label, **properties).to_list()
            created = True
        return created, elem[0] if elem.__len__() > 0 else None

    def get_or_none(self, *args, **kwargs):
        # TODO - implement this
        raise NotImplementedError()

    def bulk_write(self, *args, **kwargs):
        # TODO - implement this
        raise NotImplementedError()