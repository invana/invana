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
import pytest

from invana_py import InvanaGraph


@pytest.mark.asyncio
async def test_read_one_vertex(graph: InvanaGraph):
    old_data = graph.vertex.read_one(has__label="User")
    # print("\nold_data====", old_data)
    assert old_data.label == "User"
    assert type(old_data) is not list
    data = graph.vertex.read_one(has__id=old_data.id)
    assert data.id == old_data.id


@pytest.mark.asyncio
async def test_read_many_vertex(graph: InvanaGraph):
    data = graph.vertex.read_many(has__label="User")
    for d in data:
        assert d.label == "User"
    assert type(data) is list
    selected_ids = await graph.execute_query("g.V().hasLabel('User').id().toList()")
    data = graph.vertex.read_many(has__id__within=selected_ids)
    assert type(data) is list
    assert data.__len__() > 0
    for d in data:
        assert d.id in selected_ids


@pytest.mark.asyncio
async def test_read_many_with_pagination(graph: InvanaGraph):
    data = graph.vertex.read_many(has__label="User", pagination__limit=2)
    for d in data:
        assert d.label == "User"
    assert type(data) is list
    assert data.__len__() <= 2
