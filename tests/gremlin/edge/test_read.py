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
from tests.sample_data import EDGES_SAMPLES


def test_read_one():
    gremlin_connector = GremlinConnector('ws://megamind-ws:8182/gremlin')
    for edge in EDGES_SAMPLES:
        data = gremlin_connector.edge.read_one(**{"has__label": edge['label']})
        assert data is not None
    gremlin_connector.close_connection()


def test_read_many():
    gremlin_connector = GremlinConnector('ws://megamind-ws:8182/gremlin')
    for edge in EDGES_SAMPLES:
        data = gremlin_connector.edge.read_many(**{"has__label": edge['label']})
        assert data.__len__() > 0
    gremlin_connector.close_connection()