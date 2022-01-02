#    Copyright 2021 Invana
#
#     Licensed under the Apache License, Version 2.0 (the "License");
#     you may not use this file except in compliance with the License.
#     You may obtain a copy of the License at
#
#     http:www.apache.org/licenses/LICENSE-2.0
#
#     Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#     See the License for the specific language governing permissions and
#     limitations under the License.
from gremlin_connector import GremlinConnector

client = GremlinConnector("ws://megamind-ws:8182/gremlin")

# user = client.vertex.get_or_create("User", properties={
#     "name": "Ravi",
#     "username": "rrmerugu"
# })
# print(user)
res = client.execute_query("g.V().count()", timeout=600000)
print(res)
batch_delete_items = 1000
for i in range(1, int(res[0] / batch_delete_items)):
    print(f"g.V().limit({ batch_delete_items}).drop()")
    client.execute_query(f"g.V().limit({i*batch_delete_items}).drop()", timeout=10000000000)
    print(f"deleting {i} ")
# client.g.V().drop().next()
client.close_connection()
