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

from gremlin_driver.client import InvanaClient
from gremlin_driver.utils import async_to_sync
import logging

logging.basicConfig(level=logging.DEBUG)


async def test_queries(client):
    all_vertices_schema = await client.schema.get_all_vertices_schema()
    print("all_vertices_schema", all_vertices_schema)
    # for k, v in all_vertices_schema.items():
    #     print(k, v)

    all_edges_schema = await client.schema.get_all_edges_schema()
    print("all_edges_schema", all_edges_schema)
    # for k, v in all_edges_schema.items():
    #     print(k, v)


_client = InvanaClient("ws://localhost:8182/gremlin")

async_to_sync(test_queries(_client))
