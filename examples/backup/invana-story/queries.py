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
from gremlin_connector import GremlinConnector


def import_data():
    client = GremlinConnector("ws://localhost:8182/gremlin")

    # insta = client.execute_query("g.V().drop()", serialize=True)
    user = client.vertex.get_or_create("User", properties={
        "name": "Ravi",
        "username": "rrmerugu"
    })
    print(user)

    invana_studio_instance = client.vertex.get_or_create("GithubProject", properties={
        "name": "gremlin_connector-studio",
        "description": "opensource graph visualiser for Invana graph analytics engine"
    })
    print(invana_studio_instance)

    invana_engine_instance = client.vertex.get_or_create("GithubProject", properties={
        "name": "gremlin_connector-engine",
        "description": "Invana graph analytics engine"
    })
    print(invana_engine_instance)

    studio_edge_instance = client.edge.get_or_create("authored", user.id, invana_studio_instance.id, properties={
        "started": 2020
    })
    print(studio_edge_instance)

    engine_edge_instance = client.edge.get_or_create("authored", user.id, invana_engine_instance.id, properties={
        "started": 2020
    })
    print(engine_edge_instance)

    vertices = client.vertex.read_many(has__id=invana_studio_instance.id)
    print(vertices)

    vertices = client.vertex.read_many(has__label="GithubProject")
    print(vertices)

    vertices = client.vertex.read_many(has__label__within=["GithubProject", "User"])
    print(vertices)

    edges = client.edge.read_many(has__started__lte=2021)
    print(edges)

    vertices = client.vertex.read_many(has__name__containing="engine")
    print(vertices)


import_data()
