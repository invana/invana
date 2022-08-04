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

from invana import graph, settings
from invana.ogm import indexes
from invana.ogm.models import NodeModel, RelationshipModel, RelationshipTo, RelationshipFrom
from invana.ogm.properties import StringProperty, DateTimeProperty, IntegerProperty, BooleanProperty
from datetime import datetime

settings.GREMLIN_URL = "ws://megamind-ws:8182/gremlin"


class Project(NodeModel):
    name = StringProperty(max_length=10, trim_whitespaces=True)
    description = StringProperty(allow_null=True, min_length=10)
    is_active = BooleanProperty(default=True)
    created_at = DateTimeProperty(default=lambda: datetime.now())

    __indexes__ = (
        indexes.CompositeIndex("name"),
    )


class Authored(RelationshipModel):
    created_at = DateTimeProperty(default=lambda: datetime.now())


class Person(NodeModel):
    first_name = StringProperty(min_length=5, trim_whitespaces=True)
    last_name = StringProperty(allow_null=True)
    username = StringProperty(default="rrmerugu")
    member_since = IntegerProperty()

    projects = RelationshipTo(Project, Authored)

    __indexes__ = (
        indexes.CompositeIndex("username"),
    )


Project.objects.delete()
Person.objects.delete()
Authored.objects.delete()

person = Person.objects.create(first_name="Ravi Raja", last_name="Merugu", member_since=2000)
print("person is :", person)
project = Project.objects.create(name="Hello   ", is_active=False)
print("project is:", project)

# person.projects.

projects = Project.objects.search().to_list()
print("projects", projects)

authored_single = Authored.objects.create(person.id, project.id)
print("authored_single", authored_single)
authored = Authored.objects.search().to_list()
print("authored", authored)

graph.close_connection()
