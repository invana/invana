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

from invana.connector.connector import GremlinConnector
from invana import InvanaGraph
import logging
logging.basicConfig(filename="log.txt", filemode="w", level=logging.DEBUG)
gremlin_url = "ws://megamind-ws:8182/gremlin"
graph = InvanaGraph(gremlin_url)

schema = graph.management.schema_reader.get_graph_schema()
print(schema)
for k, vtx_schema in schema['vertices'].items():
    print(vtx_schema)
for k, vtx_schema in schema['edges'].items():
    print(vtx_schema)
# graph.close_connection()
# connector = GremlinConnector(gremlin_url)
# # connector.close()
# response = connector.execute_query("g.V().count().next()")
# # response = connector.execute_query("g.V().limit(200).elementMap().toList()")
# response = graph.execute_query("mgmt = graph.openManagement(); mgmt.printSchema()")
#
# # response = connector.g.V().search().toList()
# print("response", response.data, response.data, )
#
# print(response.data)
graph.close_connection()
