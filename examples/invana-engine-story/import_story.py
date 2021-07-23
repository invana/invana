#  Copyright 2020 Invana
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#   http:www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

from invana import InvanaClient
from invana.utils import async_to_sync


def print_list(list_data):
    print('----------')
    for data in list_data:
        print(data.to_dict())
    print('----------')


async def import_data():
    client = InvanaClient("ws://localhost:8182/gremlin")

    # insta = await client.execute_query("g.V().drop()", serialize=True)
    user = await client.vertex.get_or_create("User", properties={
        "name": "Ravi",
        "username": "rrmerugu"
    })
    print(user)

    invana_studio_instance = await client.vertex.get_or_create("GithubProject", properties={
        "name": "invana-studio",
        "description": "opensource graph visualiser for Invana graph analytics engine"
    })
    print(invana_studio_instance)

    invana_engine_instance = await client.vertex.get_or_create("GithubProject", properties={
        "name": "invana-engine",
        "description": "Invana graph analytics engine"
    })
    print(invana_engine_instance)

    studio_edge_instance = await client.edge.get_or_create("authored", user.id, invana_studio_instance.id, properties={
        "started": 2020
    })
    print(studio_edge_instance)

    engine_edge_instance = await client.edge.get_or_create("authored", user.id, invana_engine_instance.id, properties={
        "started": 2020
    })
    print(engine_edge_instance)

    vertices = await client.vertex.read_many(has__id=invana_studio_instance.id)
    print_list(vertices)

    vertices = await client.vertex.read_many(has__label="GithubProject")
    print_list(vertices)

    vertices = await client.vertex.read_many(has__label__within=["GithubProject", "User"])
    print_list(vertices)

    edges = await client.edge.read_many(has__started__lte=2021)
    print_list(edges)

    vertices = await client.vertex.read_many(has__name__containing="engine")
    print_list(vertices)

async_to_sync(import_data())
