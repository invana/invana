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

from invana_py import InvanaClient
from invana_py.utils import async_to_sync


async def test_queries(client):
    vertex = await client.vertex.create("Person", properties={"name": "Sia"})
    print(vertex)
    vertex = await client.vertex.get_or_create("Person", properties={"name": "Sia"})
    print(vertex)
    # vertex = await client.vertex.update_one(vertex.id, properties={"name": "Sia New"})
    vertex = await client.vertex.update_one(vertex.id, properties={"name": "Sia New"})
    print(vertex)
    vertex = await client.vertex.update_many(has__name="Sia New", properties={"name": "Sia New Updated"})
    print(vertex)

    vertices = await client.vertex.read_many(has__label="Person")
    print(vertices)

    vertices = await client.vertex.read_one(41021520)
    print("read_one", vertices)

    await client.vertex.delete_one(41017424)
    await client.vertex.delete_many(has__label="Person")

    # vertex = client.gremlin_client.async_to_sync(client.vertex.create(label="Person", properties={"name": "Sia"}))
    # print(vertex)
    #
    # vertices = client.gremlin_client.async_to_sync(client.vertex.read_many(has__label="Person"))
    # print(vertices)
    #


client = InvanaClient("ws://localhost:8182/gremlin")

async_to_sync(test_queries(client))
