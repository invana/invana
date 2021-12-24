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
import logging
logger = logging.getLogger(__name__)


class JanusGraphSchemaReader:

    def __init__(self, gremlin_connector):
        self.gremlin_connector = gremlin_connector

    def get_graph_schema(self):
        # TODO - can add more information from the print schema data like indexes etc to current output
        responses = self.gremlin_connector.execute_query(
            "mgmt = graph.openManagement(); mgmt.printSchema()")
        return process_graph_schema_string(responses[0]['result']['data']['@value'][0])

    def get_all_vertices_schema(self):
        # TODO - validate performance
        schema = self.get_graph_schema()
        schema_dict = {}
        for label in schema['vertex_labels'].keys():
            schema_dict[label] = schema['vertex_labels'][label]
            schema_dict[label]['property_schema'] = {}
            property_keys = []
            try:
                property_keys = self.get_vertex_schema(label)
            except Exception as e:
                logger.debug("Failed to get vertex schema of label {label} with error {error}".format(
                    label=label, error=e.__str__()))
            for property_key in property_keys:
                schema_dict[label]['property_schema'][property_key] = schema['property_keys'][property_key]

        return schema_dict

    def get_all_edges_schema(self):
        """
        :return:
        """
        # TODO - validate performance
        schema = self.get_graph_schema()
        schema_dict = {}
        for label in schema['edge_labels'].keys():
            schema_dict[label] = schema['edge_labels'][label]
            schema_dict[label]['property_schema'] = {}
            property_keys = []
            try:
                property_keys = self.get_vertex_schema(label)
            except Exception as e:
                logger.debug("Failed to get edge schema of label {label} with error {error}".format(
                    label=label, error=e.__str__()))
            for property_key in property_keys:
                schema_dict[label]['property_schema'][property_key] = schema['property_keys'][property_key]
        return schema_dict

    def get_vertex_schema(self, label):
        responses = self.gremlin_connector.execute_query(
            "g.V().hasLabel('{label}').propertyMap().select(Column.keys).next();".format(label=label)
           
        )
        return responses[0]['result']['data']['@value'] if responses[0]['result']['data'] else []

    def get_edge_schema(self, label):
        responses = self.gremlin_connector.execute_query(
            "g.E().hasLabel('{label}').propertyMap().select(Column.keys).next();".format(label=label)
           
        )
        return responses[0]['result']['data']['@value'] if responses[0]['result']['data'] else []


class JanusGraphSchema(JanusGraphSchemaReader):
    pass
