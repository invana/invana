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
from invana.ogm import indexes
from invana.ogm.fields import StringProperty
from invana.ogm.models import VertexModel

graph = InvanaGraph("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Project11(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=10, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10)
    }
    indexes = (
        indexes.CompositeIndex("name"),
    )


"""
mgmt = graph.openManagement()
mgmt.printSchema()   
"""

instances = graph.management.rollback_open_transactions(i_understand=True)
print("rollback_open_transactions", instances.data)

graph.management.create_model(Project11)
graph.management.create_index("name", label=Project11.label_name)

graph.close_connection()
