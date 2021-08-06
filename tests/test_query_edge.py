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
import time
from invana_py.utils import async_to_sync
import asyncio
import logging

logging.basicConfig(level=logging.DEBUG)


async def test_queries(client):
    sia_vertex = await client.vertex.get_or_create(label="Singer", properties={"name": "Sia"})
    song_vertex = await client.vertex.get_or_create(label="Song", properties={"name": "Chandelier"})
    print(sia_vertex)
    print(song_vertex)

    await client.edge.delete_many(has__label="written")
    edge = await client.edge.get_or_create("written",
                                           {"in_year": 2012},
                                           sia_vertex.id,
                                           song_vertex.id
                                           )
    print(edge)

    edge = await client.edge.update_one(edge.id, {"updated_": 2014})

    print(edge)

    edges = await client.edge.update_many(has__label="written", properties={"updated_at": 2014})
    print(edges)

    edge = await client.edge.read_one(edge.id)
    print(edge)

    edges = await client.edge.read_many(has__label="written")
    print(edges)
    print(edges.__len__())


client = InvanaClient("ws://localhost:8182/gremlin")

async_to_sync(test_queries(client))
