import abc
from abc import ABC
from invana.gremlin.connector import GremlinConnector
from invana.base.querysets import VertexCRUDQuerySetBase, EdgeCRUDQuerySetBase
from .resultsets import GremlinQueryResultSet

class GremlinQuerySetBase(EdgeCRUDQuerySetBase, abc.ABC):

    def __init__(self, connector: GremlinConnector):
        self.connector = connector

    @staticmethod
    def create_has_filters(**properties):
        search_kwargs = {}
        for k, v in properties.items():
            search_kwargs[f"has__{k}"] = v
        return search_kwargs


class VertexQuerySet(GremlinQuerySetBase, VertexCRUDQuerySetBase, ABC):

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


class EdgeQuerySet(GremlinQuerySetBase, EdgeCRUDQuerySetBase, ABC):

    def create(self, label, from_, to_, **properties) -> GremlinQueryResultSet:
        return GremlinQueryResultSet(self.connector.g.create_edge(label, from_, to_, **properties))

    def search(self, **search_kwarg) -> GremlinQueryResultSet:
        return GremlinQueryResultSet(self.connector.g.E().search(**search_kwarg))

    def delete(self, **search_kwarg):
        return self.search(**search_kwarg).drop()

    def get_or_create(self, label, from_, to_, **properties):
        elem = self.connector.g.V(from_).outE().search(has__label=label, **properties).where(
            __.inV().hasId(to_)).elementMap().toList()
        created = False
        if elem.__len__() == 0:
            elem = self.create(label, from_, to_, **properties).get_traversal().elementMap().toList()
            created = True
        return created, elem[0] if elem.__len__() > 0 else None
