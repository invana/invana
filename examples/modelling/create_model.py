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
from invana.ogm.properties import StringProperty, DateTimeProperty
from invana.ogm.models import NodeModel, RelationshipModel
from datetime import datetime
from invana.ogm import indexes
import os

settings.GREMLIN_URL = os.environ.get("GREMLIN_SERVER_URL", "ws://megamind-ws:8182/gremlin")


class Person(NodeModel):
    name = StringProperty(max_length=10, trim_whitespaces=True)
    about_me = StringProperty(allow_null=True, min_length=10)
    created_at = DateTimeProperty(allow_null=True)

    __indexes__ = (
        indexes.CompositeIndex("created_at"),
        indexes.MixedIndex("created_at")
    )


class Authored2(RelationshipModel):
    created_at = DateTimeProperty(default=lambda: datetime.now())

    __indexes__ = (
        indexes.CompositeIndex("name"),
    )


print(Person.__indexes__)
graph.management.create_model(Person)
graph.management.rollback_open_transactions(i_understand=True)
graph.management.create_indexes_from_model(Person)

graph.close_connection()
