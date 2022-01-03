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
import pytest
from gremlin_python.process.strategies import PartitionStrategy
from invana_py import InvanaGraph
from gremlin_python.process.traversal import T
from gremlin_python.driver.protocol import GremlinServerError
import os

GREMLIN_SERVER_URL = os.environ.get("GREMLIN_SERVER_URL", "ws://localhost:8182/gremlin")


@pytest.mark.asyncio
async def test_graph_with_readonly_strategy():
    graph = InvanaGraph(GREMLIN_SERVER_URL, read_only_mode=True)
    await graph.connect()
    with pytest.raises(GremlinServerError) as execinfo:
        graph.g.addV("Person").next()
    assert execinfo.value.args[0] == "500: The provided traversal has a mutating step" \
                                     " and thus is not read only: AddVertexStartStep({label=[Person]})"
    await graph.close_connection()


@pytest.mark.asyncio
async def test_client(graph: InvanaGraph):
    result = await graph.execute_query("g.V().limit(1).toList()")
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_client_with_partition_strategy():
    partition_strategy = PartitionStrategy(partition_key="partition_key",
                                           # write_partition="a",
                                           read_partitions=["tenant_c", "tenant_b", "tenant_a"]
                                           )
    graph = InvanaGraph(GREMLIN_SERVER_URL, strategies=[partition_strategy])
    await graph.connect()
    nodes = graph.g.V().elementMap("name").limit(1).toList()
    await graph.close_connection()
