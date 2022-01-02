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
from connection import gremlin_connector


def import_data():
    user = User.objects.get_or_create(first_name="Ravi", last_name="Merugu", username="rrmerugu")
    print(user)

    invana_studio_instance = Project.objects.get_or_create(
        name="invana-studio",
        description="opensource graph visualiser for Invana graph analytics engine"
    )
    print(invana_studio_instance)

    invana_engine_instance = Project.objects.get_or_create(
        name="invana-engine",
        description="Invana graph analytics engine"
    )
    print(invana_engine_instance)
    gremlin_connector_instance = Project.objects.get_or_create(
        name="gremlin-connector",
        description="Async python API for gremlin supported graph databases"
    )
    print(gremlin_connector_instance)

    studio_edge_instance = Authored.objects.get_or_create(user.id, invana_studio_instance.id, properties={
        "started": 2020
    })
    print(studio_edge_instance)

    engine_edge_instance = Authored.objects.get_or_create(user.id, invana_engine_instance.id, properties={
        "started": 2020
    })
    print(engine_edge_instance)

    gremlin_connector_edge_instance = Authored.objects.get_or_create(user.id, gremlin_connector_instance.id, properties={
        "started": 2022
    })
    print(gremlin_connector_edge_instance)


def run_queries():
    vertices = Project.objects.read_many(has__name__containing="engine")
    print("vertices", vertices)


def flush_data():
    Project.objects.delete_many()
    User.objects.delete_many()
    Authored.objects.delete_many()


flush_data()
import_data()
run_queries()
gremlin_connector.close_connection()
