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
from gremlin_connector.orm.models import VertexModel
from gremlin_connector.orm.fields import StringField, DateField

gremlin_connector = GremlinConnector("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Project(VertexModel):
    gremlin_connector = gremlin_connector
    fields = {
        'name': StringField(max_length=None, min_length=None, unique=True, read_only=True),
        'description': StringField(max_length=None, min_length=None, unique=True, read_only=True)
    }


for i in range(0, 10):
    project = Project.objects.create(name=f"Ravi {i}", description="Hello World")
    print("===project", project)
gremlin_connector.close_connection()
