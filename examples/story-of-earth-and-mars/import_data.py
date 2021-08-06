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
from invana_py import InvanaClient
from invana_py.utils import async_to_sync
import logging
from sample_data import EDGES_SAMPLES, VERTICES_SAMPLES

logging.basicConfig(level=logging.DEBUG)


async def import_data(client):
    for vertex in VERTICES_SAMPLES:
        _label = vertex['label']
        del vertex['label']
        vtx_instance = await client.vertex.get_or_create(_label, **vertex)
        print("vtx_instance", vtx_instance)

    for edge in EDGES_SAMPLES:
        from_vertex = await client.vertex.read_many(**edge['from_vertex_filters'])
        to_vertex = await client.vertex.read_many(**edge['to_vertex_filters'])
        print("from_vertex", from_vertex)
        print("to_vertex", to_vertex)
        edge_instance = await client.edge.get_or_create(
            edge['label'],
            from_vertex[0].id,
            to_vertex[0].id,
            properties=edge['properties']
        )
        print("edge_instance", edge_instance)


_client = InvanaClient("ws://localhost:8182/gremlin")

# _client.execute_query_as_sync("g.V().drop()")
async_to_sync(import_data(_client))
