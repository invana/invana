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
import uuid


def test_create_vertex():
    gremlin_client = GremlinClient('ws://megamind-ws:8182/gremlin')
    data = gremlin_client.vertex.create(
        "Person", properties={"name": f"Hello world - {uuid.uuid4().__str__()}"})
    gremlin_client.close_connection()

