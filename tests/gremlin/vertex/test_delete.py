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


def test_delete_one():
    graph = InvanaGraph('ws://megamind-ws:8182/gremlin')
    old_data = graph.vertex.read_one(has__label="Person")
    # delete data
    graph.vertex.delete_one(has__id=old_data.id)
    # validate if the data is deleted
    data = graph.vertex.read_one(has__id=old_data.id)
    assert data is None
    graph.close_connection()
