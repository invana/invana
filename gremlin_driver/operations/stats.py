#  Copyright 2020 Invana
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#    http:www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

from .base import CRUDOperationsBase
import logging

logger = logging.getLogger(__name__)


class GraphStatsOperations(CRUDOperationsBase):

    def get_all_vertex_stats(self):
        schema_data = self.get_graph_schema()
        data = {}
        for vertex_label in schema_data['vertex_labels']:
            data[vertex_label] = self.get_vertex_stats(vertex_label)
        return data

    def get_all_edge_stats(self):
        schema_data = self.get_graph_schema()
        data = {}
        for edge_label in schema_data['edge_labels']:
            data[edge_label] = self.get_edge_stats(edge_label)
        return data

    def get_vertex_stats(self, label):
        result = self.gremlin_client.execute_query("g.V().hasLabel('{}').count()".format(label))
        return result[0]

    def get_edge_stats(self, label):
        result = self.gremlin_client.execute_query("g.E().hasLabel('{}').count()".format(label))
        return result[0]
