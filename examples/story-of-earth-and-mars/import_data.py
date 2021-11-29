#  Copyright 2020 Invana
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#   http:www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#   http:www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
from invana_py.gremlin import GremlinClient
from gremlin_python.statics import long, FloatType
import logging
from sample_data import EDGES_SAMPLES, VERTICES_SAMPLES


# logging.basicConfig(level=logging.DEBUG)


def import_data(client):
    for vertex in VERTICES_SAMPLES:
        # _label = vertex['label']
        # del vertex['label']
        if 'mass_in_kgs' in vertex['properties']:
            vertex['properties']['mass_in_kgs'] = FloatType(vertex['properties']['mass_in_kgs'])
        vtx_instance = client.vertex.create(**vertex)
        print("vtx_instance", vtx_instance)

    # for edge in EDGES_SAMPLES:
    #     from_vertex = await client.vertex.read_many(**edge['from_vertex_filters'])
    #     to_vertex = await client.vertex.read_many(**edge['to_vertex_filters'])
    #     print("from_vertex", from_vertex)
    #     print("to_vertex", to_vertex)
    #     edge_instance = await client.edge.get_or_create(
    #         edge['label'],
    #         from_vertex[0].id,
    #         to_vertex[0].id,
    #         properties=edge['properties']
    #     )
    #     print("edge_instance", edge_instance)


def delete_data(client):
    client.vertex.delete_many(has__label__within=["Planet", "Satellite", "Star"])


_client = GremlinClient("ws://megamind-ws:8182/gremlin")

delete_data(_client)
import_data(_client)
_client.close_connection()
