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
from .utils import process_graph_schema_string
from ..base import SchemaReaderBase
from ...ogm.models import NodeModel, RelationshipModel
from ...serializer.schema_structure import VertexSchema, PropertySchema, EdgeSchema, LinkPath
import logging

logger = logging.getLogger(__name__)


class JanusGraphSchemaCreate:
    """
mgmt.getRelationTypes(PropertyKey.class)
mgmt.getRelationTypes(EdgeLabel.class)
mgmt.getVertexLabels()


    """

    @staticmethod
    def create_model(model: [NodeModel, RelationshipModel]):
        query = """mgmt = graph.openManagement()\n"""
        if model.type == "VERTEX":
            label_filter_key = "containsVertexLabel"
            get_label_method = "getVertexLabel"
            make_label_method = "makeVertexLabel"
        elif model.type == "EDGE":
            label_filter_key = "containsEdgeLabel"
            get_label_method = "getEdgeLabel"
            make_label_method = "makeEdgeLabel"
        else:
            raise ValueError("mode should of type vertex or edge")
        query += f"""
if (mgmt.{label_filter_key}('{model.label_name}'))
    {model.label_name} = mgmt.{get_label_method}('{model.label_name}')
else 
    {model.label_name} = mgmt.{make_label_method}('{model.label_name}').make()
""".lstrip("\n")
        for prop_key, prop_model in model.properties.items():
            query += f"""
if (mgmt.containsRelationType('{prop_key}'))
    {prop_key} = mgmt.getPropertyKey('{prop_key}')
else 
    {prop_key} = mgmt.makePropertyKey('{prop_key}').dataType({prop_model.get_data_type_class()}.class).make()
""".lstrip("\n")

        query += f"mgmt.addProperties({model.label_name}, {', '.join(list(model.properties.keys()))})\n"
        query += "mgmt.commit()"
        response = model.graph.connector.execute_query(query)
        return response


class JanusGraphSchemaReader(SchemaReaderBase):

    def _get_graph_schema_overview(self):
        # TODO - can add more information from the print schema data like indexes etc to current output
        response = self.connector.execute_query("mgmt = graph.openManagement(); mgmt.printSchema()")
        return process_graph_schema_string(response.data[0]) if response.data \
            else process_graph_schema_string(None)

    def get_vertex_property_keys(self, label):
        response = self.connector.execute_query(
            f"g.V().hasLabel('{label}').limit(1).propertyMap().select(Column.keys).toList();",
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
        return vertex_schema
