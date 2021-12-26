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
from gremlin_connector import GremlinConnector
from gremlin_python.statics import long, FloatType
from sample_data import EDGES_SAMPLES, VERTICES_SAMPLES


def import_data(client):
    for vertex in VERTICES_SAMPLES:
        vtx_instance = client.vertex.create(**vertex)
        print("vtx_instance", vtx_instance)

    for edge in EDGES_SAMPLES:
        from_vertex = client.vertex.read_one(**edge['from_vertex_filters'])
        to_vertex = client.vertex.read_one(**edge['to_vertex_filters'])
        edge_instance = client.edge.create(
            edge['label'],
            from_vertex.id,
            to_vertex.id,
            properties=edge['properties']
        )
        print("edge_instance", edge_instance)


def delete_data(client):
    client.vertex.delete_many(has__label__within=["Person", "Project"])


_client = GremlinConnector("ws://megamind-ws:8182/gremlin")

delete_data(_client)
import_data(_client)
_client.close_connection()
