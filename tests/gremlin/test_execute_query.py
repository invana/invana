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
from invana_py.gremlin import GremlinClient


# gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin', strategies=[partition_strategy])
# gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin', read_only_mode=False)
# raw_result = gremlin_client.execute_query("g.V().limit(10).toList()")
# value_map_result = gremlin_client.execute_query("g.V().limit(10).valueMap(true).toList()")
# value_map_result = gremlin_client.execute_query("g.V().limit(10).valueMap('name').toList()")
# element_map_result = gremlin_client.execute_query("g.V().limit(10).elementMap('name').toList()")
# print("value_map_result=====", value_map_result)
# print("element_map_result=====", element_map_result)
# for r in raw_result:
#     print("======raw_result elem =====", type(r), r, r.__dict__)
# for r in element_map_result:
#     print("======element_map elem =====", type(r), r)
# # for r in value_map_result:
# #     print("======value_map elem =====", type(r), r, r.__dict__)
#
# print("++++++++")
# nodes = gremlin_client.g.V().valueMap('name').toList()
# nodes = gremlin_client.g.V().limit(1).toList()
# nodes = gremlin_client.g.addV("MyLabel").toList()
# gremlin_client.close_connection()
# #
# print("node id", nodes)
# print("node", nodes[0])

def test_execute_query():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    data = gremlin_client.execute_query("g.V().label().dedup()")
    gremlin_client.close_connection()
