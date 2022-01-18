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
from models import User, Project, Authored, Topic, Likes
from connection import graph
import asyncio


async def import_data():
    user = await  User.objects.get_or_create(first_name="Ravi", last_name="Merugu", username="rrmerugu")
    print(user)

    invana_studio_instance = await Project.objects.get_or_create(
        name="invana-studio",
        description="opensource connector visualiser for Invana connector analytics engine"
    )
    print(invana_studio_instance)

    invana_engine_instance = await  Project.objects.get_or_create(
        name="invana-engine",
        description="Invana connector analytics engine"
    )
    print(invana_engine_instance)
    invana_py_instance = await Project.objects.get_or_create(
        name="invana-py",
        description="Python API for gremlin supported connector databases"
    )
    print(invana_py_instance)

    studio_edge_instance = await  Authored.objects.get_or_create(user.id, invana_studio_instance.id, properties={
        "started": 2020
    })
    print(studio_edge_instance)

    engine_edge_instance = await  Authored.objects.get_or_create(user.id, invana_engine_instance.id, properties={
        "started": 2020
    })
    print(engine_edge_instance)

    invana_py_edge_instance = await  Authored.objects.get_or_create(user.id, invana_py_instance.id,
                                                                    properties={
                                                                        "started": 2021
                                                                    })
    print(invana_py_edge_instance)

    topic_instance = await  Topic.objects.get_or_create(name="connector-database")
    print(topic_instance)
    likes_instance = await  Likes.objects.get_or_create(user.id, topic_instance.id)
    print(likes_instance)


async def flush_data():
    await Project.objects.delete_many()
    await User.objects.delete_many()
    await Authored.objects.delete_many()


async def close_connection():
    await graph.close_connection()


async def connect():
    await graph.connect()


asyncio.run(connect())
asyncio.run(flush_data())
asyncio.run(import_data())
asyncio.run(close_connection())
