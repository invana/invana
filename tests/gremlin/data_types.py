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
from invana_py.gremlin import GremlinClient
from invana_py.typing.elements import Node, RelationShip


def test_v_datatype():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    data = gremlin_client.execute_query("g.V().limit(1).next()")
    assert isinstance(data[0], Node)
    gremlin_client.close_connection()


def test_e_datatype():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    data = gremlin_client.execute_query("g.E().limit(1).next()")
    assert isinstance(data[0], RelationShip)
    gremlin_client.close_connection()


def test_v_elementmap_datatype():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    data = gremlin_client.execute_query("g.V().elementMap().limit(1).toList()")
    assert isinstance(data[0], Node)
    gremlin_client.close_connection()


def test_e_elementmap_datatype():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    data = gremlin_client.execute_query("g.E().elementMap().limit(1).toList()")
    assert isinstance(data[0], RelationShip)
    gremlin_client.close_connection()


def test_v_valueMap_datatype():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    data = gremlin_client.execute_query("g.V().valueMap(true).limit(1).toList()")
    assert isinstance(data[0], Node)
    gremlin_client.close_connection()


def test_e_valueMap_datatype():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    data = gremlin_client.execute_query("g.E().valueMap(true).limit(1).toList()")
    assert isinstance(data[0], Node)
    gremlin_client.close_connection()


def test_v_valueMap_with_values_datatype():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    data = gremlin_client.execute_query("g.V().valueMap('name').limit(1).toList()")
    assert isinstance(data[0], dict)
    gremlin_client.close_connection()


def test_e_valueMap_with_values_datatype():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    data = gremlin_client.execute_query("g.E().valueMap('name').limit(1).toList()")
    assert isinstance(data[0], dict)
    gremlin_client.close_connection()
