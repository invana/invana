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
from gremlin_connector import GremlinConnector

client = GremlinConnector("ws://megamind-ws:8182/gremlin", traversal_source="g")
client.execute_query_with_callback("g.V().limit(200).toList()",
                                   lambda res: print(res.__len__()),
                                   lambda: client.close_connection()
                                   )
client.close_connection()
