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
import random

gremlin_connector = GremlinConnector("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Project(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        'name': StringProperty(max_length=10, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'rating': FloatProperty(allow_null=True),
        'is_active': BooleanProperty(default=True),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


class Person(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        'first_name': StringProperty(min_length=5),
        'last_name': StringProperty(allow_null=True),
        'username': StringProperty(default="rrmerugu"),
        'member_since': IntegerProperty(),

    }


class Authored(EdgeModel):
    gremlin_connector = gremlin_connector
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


Project.objects.delete_many()
Person.objects.delete_many()
Authored.objects.delete_many()

person = Person.objects.create(first_name="Ravi Raja", last_name="Merugu", member_since=2000)
print("person is :", person)
project = Project.objects.create(name="Hello   ", rating=2.5, is_active=False)
print("project is:", project)

projects = Project.objects.read_many()
print("projects", projects)

authored_single = Authored.objects.create(person.id, project.id)
authored = Authored.objects.read_many()
print("authored", authored)

result = Project.objects.read_many(has__id=122)
print("======result", result)
# result = Project.objects.read_many(has__name__containing='invana')
# print("======result", result)

# result = gremlin_connector.vertex.read_many(has__first_name__containing='Ravi')
# print("======result", result)

result = Person.objects.read_many(has__first_name="Ravi Raja")
print("read_many", result)
person = Person.objects.update_one(query_kwargs={"has__first_name__containing": "Ravi"},
                                   properties={"last_name": f"Merugu - {random.randint(1, 1000)}"})
print("person_updated", person)

person = Person.objects.read_one(**{"has__first_name__containing": "Ravi"})
print("person_updated", person)
print("person_updated", person.to_json())
gremlin_connector.close_connection()
