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
from gremlin_connector import GremlinConnector
import logging
logging.getLogger('asyncio').setLevel(logging.INFO)
logging.basicConfig(filename='run.log', level=logging.DEBUG)


def run_query():
    client = GremlinConnector("ws://megamind-ws:8182/gremlin", traversal_source="g")

    # results = client.execute_query("g.V().elementMap().limit(4).toList()")
    # results = client.execute_query("g.E().elementMap().limit(4).toList()")
    # results = client.execute_query("g.V().valueMap(true).limit(4).toList()")
    # results = client.execute_query("g.E().valueMap(true).limit(4).toList()")
    results = client.execute_query("g.V().limit(4).toList()")
    results = client.execute_query("g.V().limit(4).toList()")
    # results = client.execute_query("g.V().limit(4).tsoList()")
    # results = client.execute_query("g.E().limit(4).toList()")
    # results = client.execute_query("g.V().schema().toList()")

    print(results)
    for result in results:
        # print(result)
        print(result)
    client.close_connection()


run_query()
