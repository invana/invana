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
from gremlin_connector.orm.fields import StringProperty, DateTimeProperty, IntegerProperty, FloatProperty, \
    BooleanProperty
from datetime import datetime

gremlin_connector = GremlinConnector("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Project(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        'name': StringProperty(max_length=10),
        'description': StringProperty(allow_null=True, min_length=10),
        'owner': StringProperty(min_length=10, default="rrmerugu-10"),
        'project_age': IntegerProperty(allow_null=True),
        'height': FloatProperty(),
        'is_active': BooleanProperty(default=True),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


class Person(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        'first_name': StringProperty(min_length=5),
        'last_name': StringProperty(min_length=5, allow_null=True),
    }


class Authored(EdgeModel):
    gremlin_connector = gremlin_connector
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())

    }


Project.objects.delete_many()
Person.objects.delete_many()
Authored.objects.delete_many()

person = Person.objects.create(first_name="Ravi Raja", last_name="Merugu")
print("person", person)
# Project.objects.create(name="Hello", description="Hello Wow, how are you")
project = Project.objects.create(name="Hello   ", height=12.1, project_age=171, is_active=False)
# project = Project.objects.create()
print("project", project)

project = Project.objects.read_one()
print("project read_one", type(project.properties.created_at))

projects = Project.objects.read_many()
print("projects", projects)

authored_single = Authored.objects.create(person.id, project.id)
authored = Authored.objects.read_many()
print("authored", authored)
print(type(authored[0].properties.created_at))

gremlin_connector.close_connection()
