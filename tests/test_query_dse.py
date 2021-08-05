#  Copyright 2020 Invana
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#   http:www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

from invana import InvanaClient
import logging

logging.basicConfig(level=logging.DEBUG)

client = InvanaClient(
    "ws://localhost:8182/gremlin",
    traversal_source="all_food"
)


def run_query(query_string):
    print("START ###########################", query_string)
    responses = client.execute_query_as_sync(query_string, serialize=True)
    message = responses[0]
    print("+result==", message)
    print("+result==", message.result.to_value())
    print("================")
    for elem in message.result.data:
        # print("+elem==", elem)
        print("+elem object==", elem)
        # print("+elem==", elem['properties'])

    print("ENDED ===========================")

    print("==================================")
    for elem in message.result.to_value()['data']:
        print("+elem dict==", elem)
        # print("+elem==", elem)
        # print("+elem==", elem['properties'])
    print("==================================")


# query_string = "g.V().hasLabel('Person').limit(2).toList()"
# query_string = "g.V().hasLabel('Person').count()"
execute_query = "g.V().hasLabel('person').valueMap(true).toList()"
# execute_query = "g.V().hasLabel('person').elementMap().toList()"
# execute_query = "g.V().hasId('dseg:/person/6c09f656-5aef-46df-97f9-e7f984c9a3d9').elementMap().toList()"
execute_query = "g.V().hasId('dseg:/person/6c09f656-5aef-46df-97f9-e7f984c9a3d9').valueMap('macro_goal').toList()"
# execute_query = "g.V().hasId('dseg:/person/46ad98ac-f5c9-4411-815a-f81b3b667921').valueMap(true).toList()"
# execute_query = "g.E().elementMap().toList()"

run_query(execute_query)
# run_query(execute_query)

# query_string = "g.E().elementMap().limit(2).toList()"
# run_query(query_string)
