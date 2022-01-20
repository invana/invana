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
from invana_py import InvanaGraph
import logging
import time
import asyncio

logging.getLogger('asyncio').setLevel(logging.INFO)
logging.basicConfig(filename='run.log', level=logging.DEBUG)


async def main():
    total_count = 1000
    start = time.time()
    graph = InvanaGraph("ws://megamind-ws:8182/gremlin", traversal_source="g")
    batch = []
    batch_size = 10
    for i in range(1, total_count):
        print(f"result {i}/{total_count} ")
        if batch.__len__() == batch_size:
            result = await asyncio.gather(*batch)
            print("result", result)
            batch = []
        else:
            batch.append(graph.vertex.create("TestLabel", properties={"name": f"name - {i}", "count": i}))
    if batch.__len__() > 0:
        result = asyncio.gather(*batch)
        print("result", result)
    graph.close_connection()
    end = time.time()
    elapsed_time = end - start

    print(f"elapsed_time {elapsed_time}")


async def main2():
    total_count = 10000
    start = time.time()
    graph = InvanaGraph("ws://localhost:8182/gremlin", traversal_source="g")
    for i in range(1, total_count):
        vtx = graph.vertex.create("TestLabel", properties={"name": f"name - {i}", "count": i})
        print(f"result {i}/{total_count} ", vtx)

    graph.close_connection()
    end = time.time()
    elapsed_time = end - start

    print(f"elapsed_time {elapsed_time}")


#asyncio.run(main())
asyncio.run(main2())
