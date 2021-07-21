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
import json
from ..core.exceptions import InvalidQueryArguments

logger = logging.getLogger(__name__)


class VertexOperations(CRUDOperationsBase):

    async def create(self, label=None, properties=None):
        """
        :param label:
        :param properties:
        :return:
        """
        logger.debug(
            "Creating vertex with label {label} and properties {properties}".format(label=label, properties=properties))
        if None in [label, properties]:
            raise Exception("Vertex cannot be created with out label and properties")
        self.validate_properties(properties)
        query_string = "g.addV('{}')".format(label)
        query_string += self.translator.generate_gremlin_query_for_properties(**properties)
        query_string += ".toList()"

        responses = await self.gremlin_client.execute_query(query_string, serialize=True)
        data = self.get_data_from_responses(responses)
        return data[0] if data and data.__len__() > 0 else None

    async def get_or_create(self, label=None, properties=None):
        """

        :param label:
        :param properties:
        :return:
        """
        if None in [properties, label]:
            raise Exception("Vertex get_or_create methods expects label and properties data")
        self.validate_properties(properties)
        search_kwargs = {"has__label": label}
        search_kwargs.update(self.translator.convert_properties_to_query(**properties))
        vertices = await self.read_many(**search_kwargs)
        if isinstance(vertices, list) and vertices.__len__() > 0:
            return vertices[0]
        return await self.create(label=label, properties=properties)

    async def update_one(self, vertex_id, properties=None):
        """
        :param vertex_id:
        :param properties:
        :return:
        """
        logger.debug("Updating vertex {vertex_id} with properties {properties}".format(
            vertex_id=vertex_id, properties=properties))
        properties = {} if properties is None else properties
        if vertex_id is None:
            raise InvalidQueryArguments("vertex_id should be sent for updating one vertex")
        query_string = self.translator.process_search_kwargs(has__id=vertex_id, element_type="V")
        query_string += self.translator.generate_gremlin_query_for_properties(**properties)
        responses = await self.gremlin_client.execute_query(query_string, serialize=True)
        _ = self.get_data_from_responses(responses)
        if _.__len__() > 0:
            return _[0]
        return

    async def update_many(self, properties=None, **search_kwargs):
        """
        :param properties: properties key value pairs to be updated
        :param search_kwargs: search query kwargs to work with invana_engine.gremlin.core.translator.GremlinQueryTranslator
        :return:
        """
        logger.debug("Updating vertex with search_kwargs{search_kwargs} with properties {properties}".format(
            search_kwargs=search_kwargs, properties=properties))
        properties = {} if properties is None else properties
        query_string = self.translator.process_search_kwargs(element_type="V", **search_kwargs)
        query_string += self.translator.generate_gremlin_query_for_properties(**properties)
        responses = await self.gremlin_client.execute_query(query_string + ".valueMap(true).toList()", serialize=True)
        return self.get_data_from_responses(responses)

    async def read_many(self, **search_kwargs):
        self.translator.validate_search_kwargs(**search_kwargs)
        query_string = self.translator.process_search_kwargs(element_type="V", **search_kwargs)
        responses = await self.gremlin_client.execute_query(query_string + ".elementMap().toList()", serialize=True)
        return self.get_data_from_responses(responses)

    async def read_one(self, vertex_id):
        if vertex_id is None:
            raise InvalidQueryArguments("vertex_id should be passed for reading one vertex")
        query_string = self.translator.process_search_kwargs(has__id=vertex_id, element_type="V")
        responses = await self.gremlin_client.execute_query(query_string + ".valueMap(true).toList()", serialize=True)
        _ = self.get_data_from_responses(responses)
        if _.__len__() > 0:
            return _[0]
        return None

    async def delete_one(self, vertex_id):
        logger.debug("Deleting the vertex with vertex_id:{vertex_id}".format(vertex_id=vertex_id))
        if vertex_id is None:
            raise InvalidQueryArguments("vertex_id should be sent for deleting one vertex")
        query_string = self.translator.process_search_kwargs(has__id=vertex_id, element_type="V")
        await self.gremlin_client.execute_query(query_string + ".drop()", serialize=False)

    async def delete_many(self, **search_kwargs):
        logger.debug("Deleting the vertex with search_kwargs:  {}".format(json.dumps(search_kwargs)))
        self.translator.validate_search_kwargs(**search_kwargs)
        query_string = self.translator.process_search_kwargs(element_type="V", **search_kwargs)
        await self.gremlin_client.execute_query(query_string + ".drop()", serialize=False)

    async def read_outedges(self, starting_vertex_filters=None, out_edge_filters=None):
        logger.debug("Reading out edges of the vertices with starting_vertex_filters:  {}".format(
            json.dumps(starting_vertex_filters)))
        self.translator.validate_search_kwargs(**starting_vertex_filters or {})
        self.translator.validate_search_kwargs(**out_edge_filters or {})
        query_string = self.translator.generate_edge_filters(
            edge_relation_type="outE",
            starting_vertex_filters=starting_vertex_filters, edge_filters=out_edge_filters)
        query_string += ".elementMap().dedup().toList();"
        responses = await self.gremlin_client.execute_query(query_string)
        return self.get_data_from_responses(responses)

    async def read_incoming_vertices_with_outedges(self, starting_vertex_filters=None, out_edge_filters=None,
                                                   inv_filters=None):
        logger.debug(
            "Reading read_incoming_vertices_with_outedges of the vertices with starting_vertex_filters:  {}".format(
                json.dumps(starting_vertex_filters)))
        self.translator.validate_search_kwargs(**starting_vertex_filters or {})
        self.translator.validate_search_kwargs(**out_edge_filters or {})
        query_string = self.translator.generate_edge_filters(
            edge_relation_type="outE",
            starting_vertex_filters=starting_vertex_filters, edge_filters=out_edge_filters)
        query_string += ".inV()"
        query_string += self.translator.process_search_kwargs(
            element_type="V", **inv_filters or {}).replace("g.V()", "")
        query_string += ".elementMap().dedup().toList();"
        responses = await self.gremlin_client.execute_query(query_string)
        return self.get_data_from_responses(responses)

    async def read_outgoing_vertices_with_outedges(self, starting_vertex_filters=None, out_edge_filters=None,
                                                   outv_filters=None):
        logger.debug(
            "Reading read_outcoming_vertices_with_outedges of the vertices with starting_vertex_filters:  {}".format(
                json.dumps(starting_vertex_filters)))
        self.translator.validate_search_kwargs(**starting_vertex_filters or {})
        self.translator.validate_search_kwargs(**out_edge_filters or {})
        query_string = self.translator.generate_edge_filters(
            edge_relation_type="outE",
            starting_vertex_filters=starting_vertex_filters, edge_filters=out_edge_filters)
        query_string += ".outV()"
        query_string += self.translator.process_search_kwargs(
            element_type="V", **outv_filters or {}).replace("g.V()", "")
        query_string += ".elementMap().dedup().toList();"
        responses = await self.gremlin_client.execute_query(query_string)
        return self.get_data_from_responses(responses)

    async def read_bothv_with_outedges(self, starting_vertex_filters=None, out_edge_filters=None,
                                       bothv_filters=None):
        logger.debug("Reading read_bothv_with_outedges of the vertices with starting_vertex_filters:  {}".format(
            json.dumps(starting_vertex_filters)))
        self.translator.validate_search_kwargs(**starting_vertex_filters or {})
        self.translator.validate_search_kwargs(**out_edge_filters or {})
        query_string = self.translator.generate_edge_filters(
            edge_relation_type="outE",
            starting_vertex_filters=starting_vertex_filters, edge_filters=out_edge_filters)
        query_string += ".bothV()"
        query_string += self.translator.process_search_kwargs(
            element_type="V", **bothv_filters or {}).replace("g.V()", "")
        query_string += ".elementMap().dedup().toList();"
        responses = await self.gremlin_client.execute_query(query_string)
        return self.get_data_from_responses(responses)

    async def read_inedges(self, starting_vertex_filters=None, in_edge_filters=None):
        logger.debug("Reading in edges of the vertices with starting_vertex_filters:  {}".format(
            json.dumps(starting_vertex_filters)))
        self.translator.validate_search_kwargs(**starting_vertex_filters or {})
        if in_edge_filters:
            self.translator.validate_search_kwargs(**in_edge_filters or {})

        query_string = self.translator.generate_edge_filters(
            edge_relation_type="inE",
            starting_vertex_filters=starting_vertex_filters, edge_filters=in_edge_filters)
        query_string += ".elementMap().dedup().toList();"
        responses = await self.gremlin_client.execute_query(query_string)
        return self.get_data_from_responses(responses)

    async def read_incoming_vertices_with_inedges(self, starting_vertex_filters=None, in_edge_filters=None,
                                                  inv_filters=None):
        logger.debug(
            "Reading read_incoming_vertices_with_inedges of the vertices with starting_vertex_filters:  {}".format(
                json.dumps(starting_vertex_filters)))
        self.translator.validate_search_kwargs(**starting_vertex_filters or {})
        if in_edge_filters:
            self.translator.validate_search_kwargs(**in_edge_filters or {})
        query_string = self.translator.generate_edge_filters(
            edge_relation_type="inE",
            starting_vertex_filters=starting_vertex_filters, edge_filters=in_edge_filters)
        query_string += ".inV()"
        query_string += self.translator.process_search_kwargs(
            element_type="V", **inv_filters or {}).replace("g.V()", "")
        query_string += ".elementMap().dedup().toList();"
        responses = await self.gremlin_client.execute_query(query_string)
        return self.get_data_from_responses(responses)

    async def read_outgoing_vertices_with_inedges(self, starting_vertex_filters=None, in_edge_filters=None,
                                                  outv_filters=None):
        logger.debug(
            "Reading read_outgoing_vertices_with_inedges of the vertices with starting_vertex_filters:  {}".format(
                json.dumps(starting_vertex_filters)))
        self.translator.validate_search_kwargs(**starting_vertex_filters or {})
        if in_edge_filters:
            self.translator.validate_search_kwargs(**in_edge_filters or {})

        query_string = self.translator.generate_edge_filters(
            edge_relation_type="inE",
            starting_vertex_filters=starting_vertex_filters, edge_filters=in_edge_filters)
        query_string += ".outV()"
        query_string += self.translator.process_search_kwargs(
            element_type="V", **outv_filters or {}).replace("g.V()", "")
        query_string += ".elementMap().dedup().toList();"
        responses = await self.gremlin_client.execute_query(query_string)
        return self.get_data_from_responses(responses)

    async def read_bothv_with_inedges(self, starting_vertex_filters=None, in_edge_filters=None,
                                      bothv_filters=None):
        logger.debug("Reading read_bothv_with_outedges of the vertices with starting_vertex_filters:  {}".format(
            json.dumps(starting_vertex_filters)))
        self.translator.validate_search_kwargs(**starting_vertex_filters or {})
        if in_edge_filters:
            self.translator.validate_search_kwargs(**in_edge_filters or {})
        query_string = self.translator.generate_edge_filters(
            edge_relation_type="inE",
            starting_vertex_filters=starting_vertex_filters, edge_filters=in_edge_filters)
        query_string += ".bothV()"
        query_string += self.translator.process_search_kwargs(
            element_type="V", **bothv_filters or {}).replace("g.V()", "")
        query_string += ".elementMap().dedup().toList();"
        responses = await self.gremlin_client.execute_query(query_string)
        return self.get_data_from_responses(responses)
