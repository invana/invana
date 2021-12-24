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


async def import_data():
    client = GremlinConnector("ws://localhost:8182/gremlin", username="user", password="password")

    results = await client.execute_query("g.V().limit(1).toList()")
    for result in results:
        print(result)
        # <g:Vertex id=4104 label=Person name=<g:String value=ravi/>/>
        print(result.to_value())
        # [{'id': 4104, 'label': 'Person', 'properties': {'name': 'ravi'}}]


async def import_data2():
    client = GremlinConnector("ws://localhost:8182/gremlin", username="user", password="password")

    results = await client.execute_query("g.V().limit(1).toList()")
    results = await client.execute_query("g.V().limit(1).next()")
    for result in results:
        print(result)


import_data()
import_data2()
