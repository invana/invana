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
from invana_py import InvanaGraph
import pytest
import asyncio
import os

GREMLIN_SERVER_URL = os.environ.get("GREMLIN_SERVER_URL")

pytest_plugins = ('pytest_asyncio',)

# @pytest.fixture(scope='session')
# async def loop():
#     return asyncio.get_event_loop()


class TestInvanaGraph:

    # @pytest.fixture
    # async def graph(self):
    #     from invana_py import InvanaGraph
    #     graph = InvanaGraph(GREMLIN_SERVER_URL)
    #     await graph.connect()
    #     return graph

    @pytest.mark.asyncio
    async def test_execute_query(self):
        print("===test execute query")
        from invana_py import InvanaGraph
        graph = InvanaGraph(GREMLIN_SERVER_URL)
        await graph.connect()
        data = await graph.execute_query("g.V().count()")
        print("======data", data)
        await graph.close_connection()

    async def test_execute_large_data_with_callback(self):
        graph = InvanaGraph('ws://localhost:8182/gremlin')
        await graph.connect()
        await graph.execute_query_with_callback("g.V().limit(200).toList()",
                                                lambda res: print(res.__len__()),
                                                lambda: graph.close_connection()
                                                )
        await graph.close_connection()
