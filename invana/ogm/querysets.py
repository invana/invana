#    Copyright 2021 Invana
#
#     Licensed under the Apache License, Version 2.0 (the "License");
#     you may not use this file except in compliance with the License.
#     You may obtain a copy of the License at
#
#     http:www.apache.org/licenses/LICENSE-2.0
#
#     Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#     See the License for the specific language governing permissions and
#     limitations under the License.

from abc import ABC
# from gremlin_python.process.traversal import Cardinality
from invana.connector.connector import GremlinConnector
from .utils import divide_chunks
from gremlin_python.process.translator import Order
from ..traversal.traversal import __
import abc


class QuerySetResultSet:

    def __init__(self, traversal):
        self._traversal = traversal

    def get_traversal(self):
        return self._traversal

    #
    # def properties(self, *args) -> list:
    #     return self.get_traversal().properties(*args).toList()
    #
    # def values(self, *args) -> list:
    #     return self.get_traversal().values(*args).toList()
    #
    # def value_map(self, *args) -> list:
    #     return self.get_traversal().valueMap(*args).toList()

    def to_list(self, *args) -> list:
        return self.get_traversal().elementMap(*args).toList()

    def values_list(self, *args, flatten=False) -> list:
        _ = self.get_traversal().properties(*args).toList()
        if flatten is True:
            return _
        return divide_chunks(_, args.__len__())

    def update(self, **properties) -> list:
        return self.get_traversal().update_properties(**properties).elementMap().toList()

    def count(self):
        _ = self.get_traversal().count().toList()
        if _.__len__() > 0:
            return _[0]

    def drop(self):
        return self.get_traversal().drop().iterate()

    def order_by(self, property_name):
        """

        :param property_name:
        :return:
        """
        _ = self.get_traversal()
        order_string = Order.desc if property_name.startswith("-") else Order.asc
        _.order().by(property_name, order_string)
        return self

    def range(self, *args):
        self.get_traversal().range(*args)
        return self


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

    def create(self, label, **properties) -> QuerySetResultSet:
        return QuerySetResultSet(self.connector.g.create_vertex(label, **properties))

    def search(self, **search_kwarg) -> QuerySetResultSet:
        return QuerySetResultSet(self.connector.g.V().search(**search_kwarg))

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


class RelationshipQuerySet(QuerySetBase, ABC):

    def create(self, label, from_, to_, **properties) -> QuerySetResultSet:
        return QuerySetResultSet(self.connector.g.create_edge(label, from_, to_, **properties))

    def search(self, **search_kwarg) -> QuerySetResultSet:
        return QuerySetResultSet(self.connector.g.E().search(**search_kwarg))

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
