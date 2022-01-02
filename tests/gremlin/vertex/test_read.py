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
from gremlin_python.process.traversal import T


def test_read_one_vertex():
    graph = InvanaGraph('ws://megamind-ws:8182/gremlin')
    old_data = graph.vertex.read_one(has__label="Person")
    # print("\nold_data====", old_data)
    assert old_data.label == "Person"
    assert type(old_data) is not list
    data = graph.vertex.read_one(has__id=old_data.id)
    assert data.id == old_data.id
    graph.close_connection()


def test_read_many_vertex():
    graph = InvanaGraph('ws://megamind-ws:8182/gremlin')
    data = graph.vertex.read_many(has__label="Person")
    for d in data:
        assert d.label == "Person"
    assert type(data) is list
    selected_ids = [8384, 16424, 16576]
    data = graph.vertex.read_many(has__id__within=selected_ids)
    assert type(data) is list
    assert data.__len__() > 0
    for d in data:
        assert d.id in selected_ids
    graph.close_connection()


def test_read_many_with_pagination():
    graph = InvanaGraph('ws://megamind-ws:8182/gremlin')
    data = graph.vertex.read_many(has__label="Person", pagination__limit=2)
    for d in data:
        assert d.label == "Person"
    assert type(data) is list
    assert data.__len__() <= 2
    graph.close_connection()


def test_read_inv_edges():
    graph = InvanaGraph('ws://megamind-ws:8182/gremlin')
    data = graph.vertex.read_inv_edges(vertex_query_kwargs={"has__label": "User"})
    print("====data", data)
    for d in data:
        assert d.label == "Person"
    assert type(data) is list
    assert data.__len__() <= 2
    graph.close_connection()
