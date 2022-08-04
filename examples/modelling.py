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
from invana import InvanaGraph
from invana.ogm.models import NodeModel
from invana.ogm.properties import StringProperty, DateTimeProperty, FloatProperty, BooleanProperty
from datetime import datetime

graph = InvanaGraph("ws://megamind-ws:8182/gremlin", traversal_source="g")


class MyProject(NodeModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=10, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'rating': FloatProperty(allow_null=True),
        'is_active': BooleanProperty(default=True),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


projects_data = [
    {
        "name": "invana py",
        "description": "API for gremlin supported graph databases"
    }
]
