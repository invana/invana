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
from invana.utils import async_to_sync


async def import_data():
    client = InvanaClient("ws://localhost:8182/gremlin", username="user", password="password")

    responses = await client.execute_query("g.V().limit(1).toList()", serialize=False)
    for response in responses:
        print(response)


async_to_sync(import_data())
