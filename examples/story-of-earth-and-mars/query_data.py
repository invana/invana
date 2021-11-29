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
from gremlin_python.statics import LongType


def query_date(client):
    # result = client.vertex.read_many(has__label__within=["Planet", "Satellite"])
    # print("==result", result)
    # for res in result:
    #     print(res)
    # result = client.vertex.read_many(has__mass_in_kgs__gt=LongType(641700000000000000000000))
    # print("==has__mass_in_kgs__gt", result)
    # for res in result:
    #     print(res)
    # result = client.vertex.read_many(has__radius_in_kms__lt=LongType(4000))
    # print("==radius_in_kms", result)
    # for res in result:
    #     print(res)

    result = client.edge.read_one(has__label="has_planet")
    print("===result", result)
    result = client.edge.read_one(to_=41080)
    print("===result to_ query", result)

    result = client.edge.read_many(has__label="has_planet")
    print("===result Planet query", result)


_client = GremlinClient("ws://megamind-ws:8182/gremlin")

query_date(_client)
_client.close_connection()
