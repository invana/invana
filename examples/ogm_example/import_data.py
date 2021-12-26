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
#

from gremlin_connector import GremlinConnector
from gremlin_connector.orm.models import VertexModel, EdgeModel
from gremlin_connector.orm.fields import StringField, DateField
from sample_data import EDGES_SAMPLES, VERTICES_SAMPLES

gremlin_connector = GremlinConnector("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Person(VertexModel):
    gremlin_connector = gremlin_connector
    fields = {
        'first_name': StringField(max_length=None, min_length=None, unique=True, read_only=True),
        'last_name': StringField(max_length=None, min_length=None, unique=True, read_only=True)
    }


class Project(VertexModel):
    gremlin_connector = gremlin_connector
    fields = {
        'name': StringField(max_length=None, min_length=None, unique=True, read_only=True),
        'description': StringField(max_length=None, min_length=None, unique=True, read_only=True)
    }


class Authored(EdgeModel):
    gremlin_connector = gremlin_connector
    fields = {}


def import_data():
    Project.objects.delete_many()
    Person.objects.delete_many()
    Authored.objects.delete_many()
    print("Deleted data")

    for vertex in VERTICES_SAMPLES:
        if vertex['label'] == "Person":
            Person.objects.create(**vertex['properties'])
        elif vertex['label'] == "Project":
            Project.objects.create(**vertex['properties'])

    for edge in EDGES_SAMPLES:
        from_vertex = None
        to_vertex = None
        if edge['from_vertex_filters']['has__label'] == "Person":
            from_vertex = Person.objects.read_one(**edge['from_vertex_filters'])
        elif edge['from_vertex_filters']['has__label'] == "Project":
            from_vertex = Project.objects.read_one(**edge['from_vertex_filters'])

        if edge['to_vertex_filters']['has__label'] == "Person":
            to_vertex = Person.objects.read_one(**edge['to_vertex_filters'])
        elif edge['to_vertex_filters']['has__label'] == "Project":
            to_vertex = Project.objects.read_one(**edge['to_vertex_filters'])

        edge_instance = Authored.objects.create(
            from_vertex.id,
            to_vertex.id,
            properties=edge['properties']
        )
        print("edge_instance", edge_instance)


import_data()

projects = Project.objects.read_many()
print("projects", projects.__len__())
gremlin_connector.close_connection()
