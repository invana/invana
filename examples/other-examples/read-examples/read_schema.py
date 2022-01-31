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

from invana import InvanaGraph
import os

GREMLIN_SERVER_URL = os.environ.get("GREMLIN_SERVER_URL", "ws://localhost:8182/gremlin")
graph = InvanaGraph(GREMLIN_SERVER_URL)
# client.g.V().drop().iterate()
schema_data = graph.backend.schema_reader.get_graph_schema()
for k, v in schema_data.items():
    for kk, vv in v.items():
        print(vv.name, list(vv.properties.keys()))

graph.close_connection()
