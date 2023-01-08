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

import abc
from invana.base.querysets.base import QuerySetBase
from invana.ogm.models import VertexModel, EdgeModel

class SchemaReaderQuerySetBase(QuerySetBase):


    @abc.abstractmethod
    def get_graph_schema(self):
        pass

    @abc.abstractmethod
    def get_vertex_schema(self, label):
        pass

    @abc.abstractmethod
    def get_edge_schema(self, label):
        pass

    @abc.abstractmethod
    def get_all_vertices_schema(self):
        pass

    @abc.abstractmethod
    def get_all_edges_schema(self):
        pass

    @abc.abstractmethod
    def get_vertex_property_keys(self, label):
        pass

    @abc.abstractmethod
    def get_edge_property_keys(self, label):
        pass



class SchemaWriterQuerySetBase(QuerySetBase):


    @abc.abstractmethod
    def create(model: [VertexModel, EdgeModel]):
        pass

    
