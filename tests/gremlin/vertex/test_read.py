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
from gremlin_python.process.traversal import T


def test_read_one_vertex():
    gremlin_connector = GremlinConnector('ws://megamind-ws:8182/gremlin')
    old_data = gremlin_connector.vertex.read_one(has__label="Person")
    # print("\nold_data====", old_data)
    assert old_data.label == "Person"
    assert type(old_data) is not list
    data = gremlin_connector.vertex.read_one(has__id=old_data.id)
    assert data.id == old_data.id
    gremlin_connector.close_connection()


def test_read_many_vertex():
    gremlin_connector = GremlinConnector('ws://megamind-ws:8182/gremlin')
    data = gremlin_connector.vertex.read_many(has__label="Person")
    for d in data:
        assert d.label == "Person"
    assert type(data) is list
    selected_ids = [8384, 16424, 16576]
    data = gremlin_connector.vertex.read_many(has__id__within=selected_ids)
    assert type(data) is list
    assert data.__len__() > 0
    for d in data:
        assert d.id in selected_ids
    gremlin_connector.close_connection()


def test_read_many_with_pagination():
    gremlin_connector = GremlinConnector('ws://megamind-ws:8182/gremlin')
    data = gremlin_connector.vertex.read_many(has__label="Person", pagination__limit=2)
    for d in data:
        assert d.label == "Person"
    assert type(data) is list
    assert data.__len__() <= 2
    gremlin_connector.close_connection()
