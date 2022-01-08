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

from models import User, Project, Authored
from connection import graph
import asyncio


async def run_queries():
    vertices = await Project.objects.read_many(has__name__containing="engine")
    print("vertices", vertices)

    vertices = await Authored.objects.read_many()
    print("vertices", vertices)

    vertices = await User.objects.read_many()
    print("vertices", vertices)

    # stats = await User.objects.get_out_edge_labels_stats()
    # print("User get_out_edge_labels_stats", stats)
    #
    # stats = await User.objects.get_in_edge_labels_stats()
    # print("User get_in_edge_labels_stats", stats)


async def close_connection():
    await graph.close_connection()


async def connect():
    await graph.connect()


asyncio.run(connect())
asyncio.run(run_queries())
asyncio.run(close_connection())
