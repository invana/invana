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
from gremlin_connector import GremlinClient
from gremlin_python.process.traversal import T
from gremlin_python.driver.protocol import GremlinServerError


def test_client_with_readonly_strategy():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin', read_only_mode=True)
    with pytest.raises(GremlinServerError) as execinfo:
        gremlin_client.g.addV("Person").toList()
    assert execinfo.value.args[0] == "500: The provided traversal has a mutating step" \
                                     " and thus is not read only: AddVertexStartStep({label=[Person]})"

    gremlin_client.close_connection()


def test_client():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    result = gremlin_client.execute_query("g.V().limit(1).toList()")
    gremlin_client.close_connection()


def test_client_with_partition_strategy():
    partition_strategy = PartitionStrategy(partition_key="partition_key",
                                           # write_partition="a",
                                           read_partitions=["tenant_c", "tenant_b", "tenant_a"]
                                           )
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin', strategies=[partition_strategy])
    nodes = gremlin_client.g.V().elementMap("name").limit(1).toList()
    gremlin_client.close_connection()


test_client()
test_client_with_partition_strategy()
