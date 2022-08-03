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

from invana.ogm.models import StructuredNode, StructuredRelationship
from invana.ogm.fields import StringProperty, IntegerProperty, DateTimeProperty, FloatProperty, \
    BooleanProperty
from datetime import datetime
from connection import graph


class User(StructuredNode):
    graph = graph
    display_property = "first_name"
    properties = {
        'first_name': StringProperty(min_length=2),
        'last_name': StringProperty(allow_null=True, min_length=2),
        'username': StringProperty(min_length=2, default="rrmerugu")
    }


class Topic(StructuredNode):
    graph = graph
    display_property = "name"
    properties = {
        'name': StringProperty(min_length=2)
    }


class Project(StructuredNode):
    graph = graph
    properties = {
        'name': StringProperty(min_length=3),
        'description': StringProperty(allow_null=True, max_length=500),
        'rating': FloatProperty(allow_null=True),
        'is_active': BooleanProperty(default=True),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


class Authored(StructuredRelationship):
    graph = graph
    properties = {
        'started': IntegerProperty()
    }


class Likes(StructuredRelationship):
    graph = graph
    properties = {}
