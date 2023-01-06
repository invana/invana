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
#
#
from ..utils import process_graph_schema_string
from invana.gremlin.schema.reader import GremlinGraphSchemaReader
from invana.ogm.models import VertexModel, EdgeModel
from invana.serializer.schema_structure import VertexSchema, PropertySchema, EdgeSchema, LinkPath
import logging

logger = logging.getLogger(__name__)




class JanusGraphSchemaReader(GremlinGraphSchemaReader):

    def _get_graph_schema_overview(self):
        # TODO - can add more information from the print schema data like indexes etc to current output
        response = self.connector.execute_query("mgmt = graph.openManagement(); mgmt.printSchema()")
        return process_graph_schema_string(response.data[0]) if response.data \
            else process_graph_schema_string(None)
 