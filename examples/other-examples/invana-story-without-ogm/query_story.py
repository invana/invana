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

graph = InvanaGraph("ws://megamind.local:8182/gremlin")

result = graph.vertex.read_many(**{"has__label": "Project"})
print("result read_many", result)
result = graph.vertex.read_oute(vertex_query_kwargs={"has__label": "User"})
print("result read_oute", result)

result = graph.vertex.read_oute(vertex_query_kwargs={"has__label": "User"}, oute_kwargs={"has__label": "authored"})
print("result read_oute with oute filters", result)

result = graph.vertex.read_oute(vertex_query_kwargs={"has__label": "User"}, oute_kwargs={"has__label": "authaored"})
print("result read_oute with oute filters", result)

result = graph.vertex.read_ine(vertex_query_kwargs={"has__label": "User"})
print("result read_ine", result)

result = graph.vertex.read_bothe(vertex_query_kwargs={"has__label": "User"})
print("result read_bothe", result)

print("======")
result = graph.vertex.read_outgoing_vertices(
    source_query_kwargs={"has__label": "User"},
    edge_kwargs={"has__label": "authored"},
    target_query_kwargs={"has__name__containing": "studio"}
)
print("result read_outgoing_vertices", result)
for r in result:
    print("outgoing vertex", r)

result = graph.execute_query("g.V().hasLabel('User').outE().label().dedup()")
print("==dedup label result ", result)

result = graph.execute_query("g.V().hasLabel('User').project('authored').by(out('authored').count())")
print("==dedup label result ", result)

result = graph.vertex.get_out_edge_labels_stats("User")
print("==get_out_edge_labels_stats label result ", result)

result = graph.vertex.get_in_edge_labels_stats("User")
print("==get_in_edge_labels_stats label result ", result)


graph.close_connection()
