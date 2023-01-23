from __future__ import annotations
from typing import TYPE_CHECKING
from .base import GremlinQuerySetBase
from invana.base.querysets.graph import VertexCRUDQuerySetBase
import abc
from ..resultsets import GremlinQueryResultSet
from gremlin_python.process.graph_traversal import __



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

    def get_or_none(self,label, **search_kwarg):
        elem = self.search(has__label=label, **self.create_has_filters(**search_kwarg))\
            .to_list()
        return elem[0] if elem.__len__() > 0 else None

    def get_by_id(self, nodeId):
        return self.search(has__id=nodeId).next()

    def bulk_write(self, *args, **kwargs):
        # TODO - implement this
        raise NotImplementedError()

    # def oute_labels(self, **search_kwargs):
    #     # TODO - performance may hurt with label
    #     pass

    # def ine_labels(self,  **search_kwargs):
    #     pass

    def oute_labels_by_id(self, node_id):
        return self.search(has__id=node_id).get_traversal().outE().label().toList()

    def ine_labels_by_id(self, node_id):
        return self.search(has__id=node_id).get_traversal().inE().label().toList()

    def bothe_labels_by_id(self, node_id):
        return self.search(has__id=node_id).get_traversal().bothE().label().toList()

    def oute_label_stats_by_id(self, node_id):
        return self.search(has__id=node_id).get_traversal().outE().groupCount().by(__.label()).toList()

    def ine_label_stats_by_id(self, node_id):
        return self.search(has__id=node_id).get_traversal().inE().groupCount().by(__.label()).toList()

    def bothe_label_stats_by_id(self, node_id):
        return self.search(has__id=node_id).get_traversal().bothE().groupCount().by(__.label()).toList()
