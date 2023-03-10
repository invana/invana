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

from gremlin_python.process.graph_traversal import GraphTraversal, GraphTraversalSource
from gremlin_python.process.traversal import P, TextP, Bytecode, Cardinality
from gremlin_python.process.graph_traversal import __ as AnonymousTraversal
from .search import GraphSearch
import copy

class InvanaTraversal(GraphTraversal):


    def clone(self):
        return InvanaTraversal(self.graph, self.traversal_strategies, copy.deepcopy(self.bytecode))

    def search(self, **kwargs):
        if kwargs.keys().__len__() == 0:
            raise Exception("search() should have kwargs")
        self.bytecode = GraphSearch.search(self.bytecode, **kwargs)
        return self

    def traverse_through(self, *edge_labels,  direction=None, **edge_search_kwargs):
        if direction not in ["in", "out", None]:
            raise Exception("valid directions are 'in' or 'out' or None")
        if direction == "in":
            self.inE(*edge_labels)
        elif direction == "out":
            self.outE(*edge_labels)
        elif direction is None:
            self.bothE(*edge_labels)
        # self.inV()            
        # if neighbor_labels:
        #     _.hasLabel(*neighbor_labels)
        # return _.path().by(__.elementMap())            
        return self


    # def to(self, *vertex_labels, **vertex_search_kwargs):
    #     vertex_search_kwargs['has__label__within'] = vertex_labels
    #     return self.search(**vertex_search_kwargs)


    def paginate(self, *args):
        self.bytecode = GraphSearch.paginate(self.bytecode, *args)
        return self

    def create_vertex(self, label, **properties):
        self.addV(label)
        for k, v in properties.items():
            self.property(k, v)
        return self

    def create_edge(self, label, from_vtx_id, to_vtx_id, **properties):
        self.addE(label).from_(__.V(from_vtx_id)).to(__.V(to_vtx_id))
        for k, v in properties.items():
            self.property(k, v)
        return self

    def update_properties(self, **properties):
        for k, v in properties.items():
            self.property(k, v)
        return self


class __(AnonymousTraversal):
    graph_traversal = InvanaTraversal

    @classmethod
    def search(cls, **kwargs):
        return cls.graph_traversal(None, None, Bytecode()).search(**kwargs)

    @classmethod
    def traverse_through(cls, *edge_labels,  direction=None, **edge_search_kwargs):
        return cls.graph_traversal(None, None, Bytecode()) \
            .traverse_through(*edge_labels,  direction=direction, **edge_search_kwargs)

    # @classmethod
    # def to(cls,  *vertex_labels, **vertex_search_kwargs):
    #     return cls.graph_traversal(None, None, Bytecode()) \
    #         .to( *vertex_labels, **vertex_search_kwargs)

    @classmethod
    def paginate(cls, *args):
        return cls.graph_traversal(None, None, Bytecode()).paginate(*args)

    @classmethod
    def create_vertex(cls, label, **properties):
        return cls.graph_traversal(None, None, Bytecode()).create_vertex(label, **properties)

    @classmethod
    def create_edge(cls, label, from_vtx_id, to_vtx_id, **properties):
        return cls.graph_traversal(None, None, Bytecode()).create_edge(label, from_vtx_id, to_vtx_id,
                                                                       **properties)

    @classmethod
    def update_properties(cls, **properties):
        return cls.graph_traversal(None, None, Bytecode()).update_properties(**properties)


class InvanaTraversalSource(GraphTraversalSource):
    def __init__(self, *args, **kwargs):
        super(InvanaTraversalSource, self).__init__(*args, **kwargs)
        self.graph_traversal = InvanaTraversal

    def create_vertex(self, label, **properties):
        traversal = self.get_graph_traversal()
        traversal.create_vertex(label, **properties)
        return traversal

    def create_edge(self, label, from_vtx_id, to_vtx_id, **properties):
        traversal = self.get_graph_traversal()
        traversal.create_edge(label, from_vtx_id, to_vtx_id, **properties)
        return traversal
 
    # def traverse_through(self, *edge_labels,  direction=None, **edge_search_kwargs):
    #     traversal = self.get_graph_traversal()
    #     traversal.traverse_through(*edge_labels,  direction=direction, **edge_search_kwargs)
    #     return traversal
