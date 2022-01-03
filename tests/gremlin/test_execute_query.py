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


class TestInvanaGraph:

    @pytest.mark.asyncio
    async def test_execute_query(self, graph: InvanaGraph):
        data = await graph.execute_query("g.V().count()")
        assert type(data) is list
        assert isinstance(data[0], int)

    @pytest.mark.asyncio
    async def test_execute_large_data_with_callback(self, graph: InvanaGraph):
        def process_response(res):
            assert isinstance(res.__len__(), int)

        await graph.execute_query_with_callback("g.V().limit(200).toList()",
                                                process_response,
                                                lambda: graph.close_connection()
                                                )
