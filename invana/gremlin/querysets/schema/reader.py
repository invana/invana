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

from invana.base.querysets.schema import SchemaReaderQuerySetBase
# from invana.ogm.models import VertexModel, EdgeModel
from invana.serializer.schema_structure import VertexSchema, PropertySchema, EdgeSchema, LinkPath
import logging

logger = logging.getLogger(__name__)



class GremlinSchemaReaderQuerySet(SchemaReaderQuerySetBase):

    def _get_graph_schema_overview(self):
        raise Exception("Not Implemented because the performance is very poor")

    def get_vertex_property_keys(self, label):
        # query = f"g.V().hasLabel(\"{label}\").group().by(label).by(properties().label().dedup().fold())"  # not performant
        query = f"g.V().hasLabel('{label}').limit(1).propertyMap().select(Column.keys).toList();"
        response = self.connector.execute_query(
            query,
            raise_exception=False
        )
        return response.data[0] if response.data.__len__() > 0 else []

    def get_edge_property_keys(self, label):
        response = self.connector.execute_query(
            f"g.E().hasLabel('{label}').limit(1).propertyMap().select(Column.keys).toList();",
            raise_exception=False
        )
        return response.data[0] if response.data.__len__() > 0 else []

    def get_graph_schema(self):
        return {
            "vertices": self.get_all_vertices_schema(),
            "edges": self.get_all_edges_schema()
        }

    def get_all_vertex_labels(self):
        schema_data = self._get_graph_schema_overview()
        return schema_data['vertex_labels'].keys()

    def get_all_edge_labels(self):
        schema_data = self._get_graph_schema_overview()
        return schema_data['edge_labels'].keys()

    def get_all_vertices_schema(self):
        schema_data = self._get_graph_schema_overview()
        all_vertex_schema = {}
        for label, vertex_details in schema_data['vertex_labels'].items():
            all_vertex_schema[label] = self.get_vertex_schema(label)
        return all_vertex_schema

    def get_all_edges_schema(self):
        schema_data = self._get_graph_schema_overview()
        all_edges_schema = {}
        for label, edge_details in schema_data['edge_labels'].items():
            all_edges_schema[label] = self.get_edge_schema(label)
        return all_edges_schema

    def get_edge_schema(self, label):
        schema_data = self._get_graph_schema_overview()
        edge_details = schema_data['edge_labels'][label]
        edge_schema = EdgeSchema(**edge_details)
        property_keys = self.get_edge_property_keys(label)
        for property_key in property_keys:
            property_schema_data = schema_data['property_keys'][property_key]
            property_schema = PropertySchema(**property_schema_data)
            edge_schema.add_property_schema(property_schema)
        link_paths = self.connector.execute_query(
            f"g.E().hasLabel('{label}').project('outv_label', 'inv_label')"
            f".by(outV().label()).by(inV().label()).dedup().toList()").data
        edge_schema.link_paths = [LinkPath(**link_path) for link_path in link_paths]
        edge_schema.property_keys = property_keys
        return edge_schema

    def get_vertex_schema(self, label):
        schema_data = self._get_graph_schema_overview()
        vertex_details = schema_data['vertex_labels'][label]
        vertex_schema = VertexSchema(**vertex_details)
        property_keys = self.get_vertex_property_keys(label)
        for property_key in property_keys:
            property_schema_data = schema_data['property_keys'][property_key]
            property_schema = PropertySchema(**property_schema_data)
            vertex_schema.add_property_schema(property_schema)
        vertex_schema.property_keys = property_keys
        return vertex_schema
