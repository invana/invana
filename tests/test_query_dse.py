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
    gremlin_traversal_source="all_food.g"
)


def run_query(query_string):
    print("START ###########################", query_string)
    responses = client.execute_query_as_sync(query_string)
    message = responses[0]
    print("+result==", message)
    print("+result==", message.to_dict())

    print("ENDED ===========================")


# query_string = "g.V().hasLabel('Person').limit(2).toList()"
# query_string = "g.V().hasLabel('Person').count()"
raw_query = "g.V().hasLabel('person').count()"

run_query(raw_query)

# query_string = "g.E().elementMap().limit(2).toList()"
# run_query(query_string)
