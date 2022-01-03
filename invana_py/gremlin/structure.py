#   Copyright 2021 Invana
#  #
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#  #
#    http:www.apache.org/licenses/LICENSE-2.0
#  #
#    Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
#
from gremlin_python.structure.graph import Vertex
from gremlin_python.process.graph_traversal import __
from gremlin_python.process.traversal import Cardinality
from invana_py.utils import calculate_time
# from ..events import register_query_event
import abc


class CRUDBase(abc.ABC):

    def __init__(self, graph):
        self.graph = graph

    @staticmethod
    @abc.abstractmethod
    def get_element_type():
        pass

    def filter_by_query_kwargs(self, element_type=None, g=None, **query_kwargs):
        return self.graph.query_kwargs.process_query_kwargs(
            element_type=element_type or self.get_element_type(),
            g=g or self.graph.g,
            **query_kwargs
        )

    def count(self, element_type=None, g=None, **query_kwargs):
        traversal = self.graph.query_kwargs.process_query_kwargs(
            element_type=element_type or self.get_element_type(),
            g=g or self.graph.g,
            **query_kwargs
        )
        return traversal.count().next()


class VertexReadMixin(CRUDBase):
    @staticmethod
    def get_element_type():
        return "V"

    def read_ine(self, vertex_query_kwargs: dict, ine_kwargs: dict = None):
        vtx_traversal = self.filter_by_query_kwargs(**vertex_query_kwargs).inE()
        _ = self.filter_by_query_kwargs(g=vtx_traversal, **ine_kwargs or {})
        result = _.elementMap().toList()
        return result

    def read_oute(self, vertex_query_kwargs: dict, oute_kwargs: dict = None):
        vtx_traversal = self.filter_by_query_kwargs(**vertex_query_kwargs).outE()
        _ = self.filter_by_query_kwargs(g=vtx_traversal, **oute_kwargs or {})
        result = _.elementMap().toList()
        return result

    def read_bothe(self, vertex_query_kwargs: dict, bothe_kwargs: dict = None):
        vtx_traversal = self.filter_by_query_kwargs(**vertex_query_kwargs).bothE()
        _ = self.filter_by_query_kwargs(g=vtx_traversal, **bothe_kwargs or {})
        result = _.elementMap().toList()
        return result

    def read_incoming_vertices(self,
                               source_query_kwargs: dict,
                               edge_kwargs: dict,
                               target_query_kwargs: dict
                               ):
        source_traversal = self.filter_by_query_kwargs(**source_query_kwargs).inE()
        edge_traversal = self.filter_by_query_kwargs(g=source_traversal, **edge_kwargs or {}).outV()
        _ = self.filter_by_query_kwargs(g=edge_traversal, **target_query_kwargs or {})
        result = _.elementMap().toList()
        return result

    def read_outgoing_vertices(self,
                               source_query_kwargs: dict,
                               edge_kwargs: dict,
                               target_query_kwargs: dict
                               ):
        source_traversal = self.filter_by_query_kwargs(**source_query_kwargs).outE()
        edge_traversal = self.filter_by_query_kwargs(g=source_traversal, **edge_kwargs or {}).inV()
        _ = self.filter_by_query_kwargs(g=edge_traversal, **target_query_kwargs or {})
        result = _.elementMap().toList()
        return result

    def read_incoming_and_outgoing_vertices(self,
                                            source_query_kwargs: dict,
                                            edge_kwargs: dict,
                                            target_query_kwargs: dict):
        incoming_vertices = self.read_incoming_vertices(source_query_kwargs=source_query_kwargs,
                                                        edge_kwargs=edge_kwargs,
                                                        target_query_kwargs=target_query_kwargs)
        outgoing_vertices = self.read_outgoing_vertices(source_query_kwargs=source_query_kwargs,
                                                        edge_kwargs=edge_kwargs,
                                                        target_query_kwargs=target_query_kwargs)
        return incoming_vertices + outgoing_vertices

    @staticmethod
    def _create_project_string(labels):
        query_string = "project("
        for label in labels:
            query_string += f"'{label}',"
        query_string.strip(",")
        query_string += ")"
        return query_string

    @staticmethod
    def _create_by_string(labels, direction):
        query_string = ""
        for label in labels:
            query_string += f".by({direction}('{label}').count())"
        return query_string

    def get_in_edge_labels(self, label):
        return self.graph.execute_query(f"g.V().hasLabel('{label}').inE().label().dedup()")

    def get_out_edge_labels(self, label):
        return self.graph.execute_query(f"g.V().hasLabel('{label}').outE().label().dedup()")

    def get_in_edge_labels_stats(self, label):
        edge_labels = self.get_in_edge_labels(label)
        if edge_labels.__len__() == 0:
            return {}
        query_string = f"g.V().hasLabel('{label}')"
        query_string += self._create_project_string(edge_labels)
        query_string += self._create_by_string(edge_labels, "in")
        result = self.graph.execute_query(query_string)
        return result[0]

    def get_out_edge_labels_stats(self, label):
        edge_labels = self.get_out_edge_labels(label)
        if edge_labels.__len__() == 0:
            return {}
        query_string = f"g.V().hasLabel('{label}')"
        query_string += self._create_project_string(edge_labels)
        query_string += self._create_by_string(edge_labels, "out")
        result = self.graph.execute_query(query_string)
        return result[0]


class VertexCRUD(VertexReadMixin, CRUDBase):

    @staticmethod
    def get_element_type():
        return "V"

    def create(self, label, properties=None):
        _ = self.graph.g.addV(label)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        return _.next()

    # @calculate_time
    def read_one(self, **query_kwargs) -> Vertex:
        _ = self.filter_by_query_kwargs(pagination__limit=1, **query_kwargs)
        # register_query_event(_.__str__())
        result = _.elementMap().toList()
        return result[0] if result.__len__() > 0 else None

    def get_or_create(self, label, properties=None):
        properties = properties if properties else {}
        properties_kwargs = {}
        if label:
            properties_kwargs[f"has__label"] = label
        properties_kwargs.update({f"has__{k}": v for k, v in properties.items()})
        result = self.read_one(**properties_kwargs)
        if result:
            return result
        return self.create(label, properties=properties)

    def read_many(self, **query_kwargs) -> list:
        _ = self.filter_by_query_kwargs(**query_kwargs)
        # register_query_event(_.__str__())
        return _.elementMap().toList()

    def update_one(self, query_kwargs=None, properties=None):
        _ = self.filter_by_query_kwargs(pagination__limit=1, **query_kwargs)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        result = _.elementMap().toList()
        return result[0] if result.__len__() > 0 else None

    def update_many(self, query_kwargs=None, properties=None):
        _ = self.filter_by_query_kwargs(**query_kwargs)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        result = _.elementMap().toList()
        return result

    def delete_one(self, **query_kwargs):
        return self.filter_by_query_kwargs(pagination__limit=1, **query_kwargs).drop().iterate()

    def delete_many(self, **query_kwargs):
        return self.filter_by_query_kwargs(**query_kwargs).drop().iterate()


class EdgeCRUD(CRUDBase):

    @staticmethod
    def get_element_type():
        return "E"

    def filter_e_by_query_kwargs(self, from_=None, to_=None, **query_kwargs):
        if from_ and to_:
            _ = self.graph.g.V(from_).outE()
            _ = self.filter_by_query_kwargs(g=_, **query_kwargs)
            getattr(_, "where")(__.inV().hasId(to_))
        elif from_ and not to_:
            _ = self.graph.g.V(from_).outE()
            _ = self.filter_by_query_kwargs(g=_, **query_kwargs)
        elif not from_ and to_:
            _ = self.graph.g.V(to_).inE()
            _ = self.filter_by_query_kwargs(g=_, **query_kwargs)
        else:
            _ = self.filter_by_query_kwargs(**query_kwargs)
        return _

    def create(self, label, from_, to_, properties=None):
        _ = self.graph.g.addE(label).from_(__.V(from_)).to(__.V(to_))
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        return _.next()

    def read_one(self, from_=None, to_=None, **query_kwargs):
        _ = self.filter_e_by_query_kwargs(from_=from_, to_=to_, pagination__limit=1, **query_kwargs)
        result = _.elementMap().toList()
        return result[0] if result.__len__() > 0 else None

    def get_or_create(self, label, from_, to_, properties=None):
        properties = properties if properties else {}
        query_kwargs = {}
        if label:
            query_kwargs[f"has__label"] = label
        query_kwargs.update({f"has__{k}": v for k, v in properties.items()})
        result = self.read_one(from_=from_, to_=to_, **query_kwargs)
        if result:
            return result
        return self.create(label, from_, to_, properties=properties)

    def read_many(self, from_=None, to_=None, **query_kwargs):
        _ = self.filter_e_by_query_kwargs(from_=from_, to_=to_, **query_kwargs)
        result = _.elementMap().toList()
        return result

    def update_one(self, from_=None, to_=None, query_kwargs=None, properties=None):
        _ = self.filter_e_by_query_kwargs(from_=from_, to_=to_, pagination__limit=1, **query_kwargs)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        result = _.elementMap().toList()
        return result[0] if result.__len__() > 0 else None

    def update_many(self, from_=None, to_=None, query_kwargs=None, properties=None):
        _ = self.filter_e_by_query_kwargs(from_=from_, to_=to_, **query_kwargs)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        result = _.elementMap().toList()
        return result

    def delete_one(self, from_=None, to_=None, **query_kwargs):
        return self.filter_e_by_query_kwargs(from_=from_, to_=to_, pagination__limit=1, **query_kwargs).drop().iterate()

    def delete_many(self, from_=None, to_=None, **query_kwargs):
        return self.filter_e_by_query_kwargs(from_=from_, to_=to_, **query_kwargs).drop().iterate()