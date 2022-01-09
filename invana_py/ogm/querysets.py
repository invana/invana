from abc import ABC
from gremlin_python.process.traversal import Cardinality
from invana_py.connector.connector import GremlinConnector
from ..traversal.traversal import __
import abc


class QuerySetResult:

    def __init__(self, traversal):
        self._traversal = traversal

    def get_traversal(self):
        return self._traversal

    def properties(self, *args) -> list:
        return self.get_traversal().properties(*args).toList()

    def values(self, *args) -> list:
        return self.get_traversal().values(*args).toList()

    def value_map(self, *args) -> list:
        return self.get_traversal().valueMap(*args).toList()

    def element_map(self, *args) -> list:
        return self.get_traversal().elementMap(*args).toList()

    def update(self, **properties) -> list:
        return self.get_traversal().update_properties(**properties).element_map()

    def count(self):
        return self.get_traversal().count()


class QuerySetBase(abc.ABC):

    def __init__(self, connector: GremlinConnector):
        self.connector = connector

    @abc.abstractmethod
    def create(self, *args, **kwargs):
        pass

    @abc.abstractmethod
    def search(self, *args, **kwargs):
        pass

    @abc.abstractmethod
    def delete(self, *args, **kwargs):
        pass

    @abc.abstractmethod
    def get_or_create(self, *args, **kwargs):
        pass

    # @abc.abstractmethod
    # def count(self, *args, **kwargs):
    #     pass

    @staticmethod
    def create_has_filters(**properties):
        search_kwargs = {}
        for k, v in properties.items():
            search_kwargs[f"has__{k}"] = v
        return search_kwargs


class VertexQuerySet(QuerySetBase, ABC):

    def create(self, label, **properties) -> QuerySetResult:
        return QuerySetResult(self.connector.g.create_vertex(label, **properties))

    def search(self, **search_kwarg) -> QuerySetResult:
        return QuerySetResult(self.connector.g.V().search(**search_kwarg))

    def delete(self, **search_kwarg):
        return self.search(**search_kwarg).get_traversal().drop()

    def get_or_create(self, label, **properties):
        elem = self.search(has__label=label, **self.create_has_filters(**properties)) \
            .element_map()
        created = False
        if elem.__len__() == 0:
            elem = self.create(label, **properties).element_map()
            created = True
        return created, elem[0] if elem.__len__() > 0 else None


class EdgeQuerySet(QuerySetBase, ABC):

    def create(self, label, from_, to_, **properties) -> QuerySetResult:
        return QuerySetResult(self.connector.g.create_edge(label, from_, to_, **properties))

    def search(self, **search_kwarg) -> QuerySetResult:
        return QuerySetResult(self.connector.g.E().search(**search_kwarg))

    def delete(self, **search_kwarg):
        return self.search(**search_kwarg).get_traversal().drop()

    def get_or_create(self, label, from_, to_, **properties):
        elem = self.connector.g.V(from_).outE().search(has__label=label, **properties).where(
            __.inV().hasId(to_)).elementMap().toList()
        created = False
        if elem.__len__() == 0:
            elem = self.create(label, from_, to_, **properties).get_traversal().elementMap().toList()
            created = True
        return created, elem[0] if elem.__len__() > 0 else None
