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

from invana.gremlin import GremlinClient
from invana.typing import ResponseMessage

client = GremlinClient("ws://localhost:8182/gremlin")


def run_query(query_string):
    print("START ###########################", query_string)

    elems = client.execute_query_as_sync(query_string)
    message = elems[0]
    print("+result==", message)
    print("+result==", message.to_dict())
    # for element in message.result.data:
    #     print("++element==", element)
    #     for prop in element.properties:
    #         print("prop==", prop)
    print("ENDED ===========================")


# query_string = "g.E().elementMap().limit(2).toList()"
# query_string = "g.E().elementMap(true).limit(2).toList()"
# query_string = "g.E().limit(2).toList()"
#
# query_string = "g.V().valueMap(true).limit(2).toList()"
# query_string = "g.V().limit(2).toList()"
# run_query(query_string)

query_string = "g.E().limit(2).toList()"
run_query(query_string)

query_string = "g.E().elementMap().limit(2).toList()"
run_query(query_string)
#
# query_string = "g.E().valueMap(true).limit(2).toList()"
# run_query(query_string)

#
# query_string = "g.V().limit(2).toList()"
# run_query(query_string)
#
# query_string = "g.V().elementMap().limit(2).toList()"
# run_query(query_string)
#
# query_string = "g.V().valueMap(true).limit(2).toList()"
# run_query(query_string)
#
# query_string = "g.V().path()"
# run_query(query_string)
# #
# query_string = "g.V().outE().path()"
# run_query(query_string)
