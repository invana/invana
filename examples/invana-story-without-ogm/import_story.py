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
from invana_py import InvanaGraph


def import_data(graph):
    user = graph.vertex.get_or_create("User", properties={
        "first_name": "Ravi",
        "last_name": "Merugu",
        "username": "rrmerugu"
    })
    print(user)

    invana_studio_instance = graph.vertex.get_or_create("GithubProject", properties={
        "name": "invana-studio",
        "description": "opensource graph visualiser for Invana graph analytics engine"
    })
    print(invana_studio_instance)

    invana_engine_instance = graph.vertex.get_or_create("GithubProject", properties={
        "name": "invana-engine",
        "description": "Invana graph analytics engine"
    })
    print(invana_engine_instance)

    studio_edge_instance = graph.edge.get_or_create("authored", user.id, invana_studio_instance.id, properties={
        "started": 2020
    })
    print(studio_edge_instance)

    engine_edge_instance = graph.edge.get_or_create("authored", user.id, invana_engine_instance.id, properties={
        "started": 2020
    })
    print(engine_edge_instance)


def run_queries(graph):
    vertices = graph.vertex.read_many(has__label="User")
    print(vertices)

    vertices = graph.vertex.read_many(has__label__within=["GithubProject", "User"])
    print(vertices)

    edges = graph.edge.read_many(has__started__lte=2021)
    print(edges)

    vertices = graph.vertex.read_many(has__name__containing="engine")
    print(vertices)


graph = InvanaGraph("ws://localhost:8182/gremlin")
import_data(graph)
run_queries(graph)
graph.close_connection()
