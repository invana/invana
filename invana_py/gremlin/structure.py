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
from gremlin_python.process.traversal import Cardinality
from ..events import register_query_event


class VertexCRUD:

    def __init__(self, gremlin_client=None):
        self.gremlin_client = gremlin_client

    def create(self, label=None, properties=None):
        _ = self.gremlin_client.g.addV(label)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        return _.next()

    def _read(self, **query_kwargs):
        return self.gremlin_client.query_kwargs.process_query_kwargs(
            element_type="V", g=self.gremlin_client.g, **query_kwargs)

    def read_one(self, **query_kwargs) -> Vertex:
        result = self._read(pagination__limit=1, **query_kwargs).elementMap().toList()
        return result[0] if result.__len__() > 0 else None

    def read_many(self, **query_kwargs) -> list:
        _ = self._read(**query_kwargs)
        register_query_event(_.__str__())
        return _.elementMap().toList()

    def update_one(self, query_kwargs=None, properties=None):
        _ = self._read(pagination__limit=1, **query_kwargs)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        return _.elementMap().next()

    def update_many(self, query_kwargs=None, properties=None):
        _ = self._read(**query_kwargs)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        return _.elementMap().toList()

    def delete_one(self, **query_kwargs):
        return self._read(pagination__limit=1, **query_kwargs).drop().iterate()

    def delete_many(self, **query_kwargs):
        return self._read(**query_kwargs).drop().iterate()
