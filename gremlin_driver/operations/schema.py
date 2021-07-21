#  Copyright 2020 Invana
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#    http:www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

from .base import CRUDOperationsBase
import logging

logger = logging.getLogger(__name__)


class SchemaReadOperations(CRUDOperationsBase):

    async def get_graph_schema(self):
        # TODO - can add more information from the print schema data like indexes etc to current output
        responses = await self.gremlin_client.execute_query(
            "mgmt = graph.openManagement(); mgmt.printSchema()", serialize=False)
        return self.process_graph_schema_string(responses[0]['result']['data']['@value'][0])

    async def get_all_vertices_schema(self):
        # TODO - validate performance
        schema = await self.get_graph_schema()
        schema_dict = {}
        for label in schema['vertex_labels'].keys():
            schema_dict[label] = schema['vertex_labels'][label]
            schema_dict[label]['property_schema'] = {}
            for property_key in await self.get_vertex_schema(label):
                schema_dict[label]['property_schema'][property_key] = schema['property_keys'][property_key]
        return schema_dict

    async def get_all_edges_schema(self):
        """

        :return:
        """
        # TODO - validate performance
        schema = await self.get_graph_schema()
        schema_dict = {}
        for label in schema['edge_labels'].keys():
            schema_dict[label] = schema['edge_labels'][label]
            schema_dict[label]['property_schema'] = {}
            for property_key in await self.get_edge_schema(label):
                schema_dict[label]['property_schema'][property_key] = schema['property_keys'][property_key]
        return schema_dict

    async def get_vertex_schema(self, label):
        responses = await self.gremlin_client.execute_query(
            "g.V().hasLabel('{label}').propertyMap().select(Column.keys).next();".format(label=label),
            serialize=False
        )
        return responses[0]['result']['data']['@value'] if responses[0]['result']['data'] else []

    async def get_edge_schema(self, label):
        responses = await self.gremlin_client.execute_query(
            "g.E().hasLabel('{label}').propertyMap().select(Column.keys).next();".format(label=label),
            serialize=False
        )
        return responses[0]['result']['data']['@value'] if responses[0]['result']['data'] else []


class SchemaCreateUpdateOperations(CRUDOperationsBase):
    default_data_type = "String"
    default_cardinality_type = "SINGLE"
    allowed_data_types = [
        "String", "Character", "Boolean", "Byte", "Short", "Integer", "Long",
        "Float", "Double", "Date", "Geoshape", "UUID"
    ]
    allowed_cardinality_types = [
        "SINGLE", "LIST", "SET"
    ]

    def validate_data_type(self, data_type, property_label):
        if data_type not in self.allowed_data_types:
            raise Exception("only data types: {}  are allowed, "
                            "but received '{}' type for property {}".format(
                self.allowed_data_types, data_type, property_label))

    def validate_cardinality_type(self, cardinality_type, property_label):
        if cardinality_type not in self.allowed_cardinality_types:
            raise Exception("only cardinality types: {}  are allowed, "
                            "but received '{}' type for property {}".format(
                self.allowed_cardinality_types, cardinality_type, property_label))

    def create_schema_string_of_properties_schema(self, **properties_schema):
        """
        Refer https://docs.janusgraph.org/basics/schema/#property-key-data-type

        :param properties_schema: properties . example **{"name": {"data_type": "Long", "cardinality": "SINGLE"}}
        :return:
        """
        query_string = ""
        for property_label, property_schema in properties_schema.items():
            data_type = property_schema.get("data_type", self.default_data_type).capitalize()
            cardinality_type = property_schema.get("cardinality", self.default_cardinality_type).upper()

            self.validate_data_type(data_type, property_label)
            self.validate_data_type(data_type, property_label)
            # TODO - refactor janusgraph specific path for cardinality `org.janusgraph.core.`
            query_string += """
{property_label} = mgmt.makePropertyKey('{property_label}')
                            .dataType({data_type}.class)
                            .cardinality(org.janusgraph.core.Cardinality.{cardinality_type})
                            .make()""".format(property_label=property_label,
                                              cardinality_type=cardinality_type,
                                              data_type=data_type)
            # query_string += "{property_label} = mgmt.makePropertyKey('{property_label}')" \
            #                 ".dataType({data_type}.class)" \
            #                 ".cardinality(Cardinality.{cardinality_type})" \
            #                 ".make()\n".format(property_label=property_label,
            #                                    cardinality_type=cardinality_type,
            #                                    data_type=data_type)

        return query_string

    def create_schema(self, element_type, label, **properties_schema):
        query_string = """        
        mgmt = graph.openManagement()
        {label} = mgmt.make{element_type}Label('{label}').make()
                """.format(label=label, element_type=element_type.capitalize())
        query_string += self.create_schema_string_of_properties_schema(**properties_schema)
        query_string += "\nmgmt.addProperties({label},{properties})\n".format(
            label=label, properties=",".join(list(properties_schema.keys())))
        query_string += "mgmt.commit()"
        _ = self.gremlin_client.execute_query(query_string, serialize=False)
        return _

    def create_edge_label_with_schema(self, label, **properties_schema):
        """
        USAGE:
        create_edge_label_with_schema("Planet",
                        name={"data_type": "Long", "cardinality": "SINGLE"}
                        )

        :param label: vertex label name . example: Planet
        :param properties_schema: properties . example **{"name": {"data_type": "Long", "cardinality": "SINGLE"}}
        :return:

        property types : https://docs.janusgraph.org/basics/schema/#property-key-data-type
        """
        return self.create_schema("edge", label, **properties_schema)

    def create_vertex_label_with_schema(self, label, **properties_schema):
        """

        property types : https://docs.janusgraph.org/basics/schema/#property-key-data-type

        :param label: vertex label name . example: Planet
        :param properties_schema: properties . example **{"name": {"data_type": "Long", "cardinality": "SINGLE"}}
        :return:
        """
        return self.create_schema("vertex", label, **properties_schema)

    def update_property_name(self, old_name, new_name):
        query_string = """
mgmt = graph.openManagement()
{old_name} = mgmt.getPropertyKey('{old_name}')
mgmt.changeName({old_name}, '{new_name}')
mgmt.commit()        
        """.format(old_name=old_name, new_name=new_name)
        return self.gremlin_client.execute_query(query_string, serialize=False)

    def update_vertex_label(self, old_name, new_name):
        query_string = """
mgmt = graph.openManagement()
{old_name} = mgmt.getVertexLabel('{old_name}')
mgmt.changeName({old_name}, '{new_name}')
mgmt.commit()        
        """.format(old_name=old_name, new_name=new_name)
        return self.gremlin_client.execute_query(query_string, serialize=False)

    def update_edge_label(self, old_name, new_name):
        query_string = """
mgmt = graph.openManagement()
{old_name} = mgmt.getEdgeLabel('{old_name}')
mgmt.changeName({old_name}, '{new_name}')
mgmt.commit()        
        """.format(old_name=old_name, new_name=new_name)
        return self.gremlin_client.execute_query(query_string, serialize=False)


class SchemaAllOperations(SchemaReadOperations, SchemaCreateUpdateOperations):
    pass
