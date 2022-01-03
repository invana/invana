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
from invana_py import InvanaGraph
from tests.sample_data import EDGES_SAMPLES
import pytest


@pytest.mark.asyncio
async def test_edge_create(graph: InvanaGraph):
    for edge in EDGES_SAMPLES:
        from_vtx = await graph.vertex.read_one(**edge['from_vertex_filters'])
        to_vtx = await graph.vertex.read_one(**edge['to_vertex_filters'])
        data = await graph.edge.create(edge['label'], from_vtx.id, to_vtx.id, properties=edge['properties'], )
