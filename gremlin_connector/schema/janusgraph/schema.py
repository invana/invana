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
#
from .utils import process_graph_schema_string
from gremlin_connector.typing.schema import PropertySchema, VertexSchema, EdgeSchema
import logging

logger = logging.getLogger(__name__)


class JanusGraphSchemaReader:

    def __init__(self, gremlin_connector):
        self.gremlin_connector = gremlin_connector

    def _get_graph_schema_overview(self):
        # TODO - can add more information from the print schema data like indexes etc to current output
        responses = self.gremlin_connector.execute_query("mgmt = graph.openManagement(); mgmt.printSchema()")
        return process_graph_schema_string(responses[0])

    def _get_vertex_property_keys(self, label):
        try:
            return self.gremlin_connector.execute_query(
                "g.V().hasLabel('{label}').propertyMap().select(Column.keys).next();".format(label=label)
            ) or []
        except Exception as e:
            logger.debug("Failed to get vertex schema of label {label} with error {error}".format(
                label=label, error=e.__str__()))
        return []

    def _get_edge_property_keys(self, label):
        try:
            return self.gremlin_connector.execute_query(
                "g.E().hasLabel('{label}').propertyMap().select(Column.keys).next();".format(label=label)
            ) or []
        except Exception as e:
            logger.debug("Failed to get vertex schema of label {label} with error {error}".format(
                label=label, error=e.__str__()))
        return []

    def get_graph_schema(self):
        return {
            "vertices": self.get_all_vertices_schema(),
            "edges": self.get_all_edges_schema()
        }

    def get_all_vertices_schema(self):
        schema_data = self._get_graph_schema_overview()
        all_vertex_schema = {}
        for label, vertex_details in schema_data['vertex_labels'].items():
            vertex_schema = VertexSchema(**vertex_details)
            property_keys = self._get_vertex_property_keys(label)
            for property_key in property_keys:
                property_schema_data = schema_data['property_keys'][property_key]
                property_schema = PropertySchema(**property_schema_data)
                vertex_schema.add_property_schema(property_schema)
            all_vertex_schema[label] = vertex_schema
        return all_vertex_schema

    def get_all_edges_schema(self):
        schema_data = self._get_graph_schema_overview()
        all_edges_schema = {}
        for label, edge_details in schema_data['edge_labels'].items():
            edge_schema = EdgeSchema(**edge_details)
            property_keys = self._get_edge_property_keys(label)
            for property_key in property_keys:
                property_schema_data = schema_data['property_keys'][property_key]
                property_schema = PropertySchema(**property_schema_data)
                edge_schema.add_property_schema(property_schema)
            all_edges_schema[label] = edge_schema
        return all_edges_schema

    def get_edge_schema(self, label):
        schema_data = self._get_graph_schema_overview()
        edge_details = schema_data['edge_labels'][label]
        edge_schema = EdgeSchema(**edge_details)
        property_keys = self._get_edge_property_keys(label)
        for property_key in property_keys:
            property_schema_data = schema_data['property_keys'][property_key]
            property_schema = PropertySchema(**property_schema_data)
            edge_schema.add_property_schema(property_schema)
        return edge_schema

    def get_vertex_schema(self, label):
        schema_data = self._get_graph_schema_overview()
        vertex_details = schema_data['vertex_labels'][label]
        vertex_schema = VertexSchema(**vertex_details)
        property_keys = self._get_vertex_property_keys(label)
        for property_key in property_keys:
            property_schema_data = schema_data['property_keys'][property_key]
            property_schema = PropertySchema(**property_schema_data)
            vertex_schema.add_property_schema(property_schema)
        return vertex_schema


class JanusGraphSchema(JanusGraphSchemaReader):
    pass
