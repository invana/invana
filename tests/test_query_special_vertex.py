#  Copyright 2020 Invana
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#   http:www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

from invana_py import InvanaClient
from invana_py.utils import async_to_sync
import logging

logging.basicConfig(level=logging.DEBUG)


def print_list(list_data):
    for data in list_data:
        print(data)
    print("==============")


async def test_queries(client):
    starting_vertex_filters = {
        "has__label": "Planet",
    }
    edge_filters = {
        # "has__label__within": ["has_neighbor_planet", "has_satellite"]
        "has__label__within": ["has_satellite"],
        "has__distance_in_kms__gte": 7000
    }
    incoming_vertex_filters = {
        # "has__radius_in_kms__lte": 4000
    }
    outgoing_vertex_filters = {
        "has__radius_in_kms__lte": 4000
    }
    read_outedges = await client.vertex.read_outedges(
        starting_vertex_filters=starting_vertex_filters,
        out_edge_filters=edge_filters
    )
    print("read_outedges")
    print_list(read_outedges)

    read_incoming_vertices_with_outedges = await client.vertex.read_incoming_vertices_with_outedges(
        starting_vertex_filters=starting_vertex_filters,
        out_edge_filters=edge_filters,
        inv_filters=incoming_vertex_filters
    )
    print("read_incoming_vertices_with_outedges")
    print_list(read_incoming_vertices_with_outedges)

    read_outgoing_vertices_with_outedges = await client.vertex.read_outgoing_vertices_with_outedges(
        starting_vertex_filters=starting_vertex_filters,
        out_edge_filters=edge_filters,
        outv_filters=outgoing_vertex_filters
    )
    print("read_outgoing_vertices_with_outedges")
    print_list(read_outgoing_vertices_with_outedges)

    read_bothv_with_outedges = await client.vertex.read_bothv_with_outedges(
        starting_vertex_filters=starting_vertex_filters,
        out_edge_filters=edge_filters,
        # bothv_filters=outgoing_vertex_filters
    )
    print("read_bothv_with_outedges")
    print_list(read_bothv_with_outedges)

    # out_edges_of_vertices = await client.vertex.read_in_edges(
    #     has__label="Song",
    #     # fetch_incoming_vertices=True,
    #     # fetch_outgoing_vertices=True
    # )
    # print("out_edges_of_vertices", out_edges_of_vertices)


async def test_queries_inedges(client):
    starting_vertex_filters = {
        "has__label": "Planet",
    }
    edge_filters = {
        # "has__label__within": ["has_neighbor_planet", "has_satellite"]
        "has__label__within": ["has_satellite"],
        "has__distance_in_kms__gte": 7000
    }
    incoming_vertex_filters = {
        # "has__radius_in_kms__lte": 4000
    }
    outgoing_vertex_filters = {
        "has__radius_in_kms__lte": 4000
    }
    read_inedges = await client.vertex.read_inedges(
        starting_vertex_filters=starting_vertex_filters,
        in_edge_filters=edge_filters
    )
    print("read_inedges")
    print_list(read_inedges)

    read_incoming_vertices_with_inedges = await client.vertex.read_incoming_vertices_with_inedges(
        starting_vertex_filters=starting_vertex_filters,
        in_edge_filters=edge_filters,
        inv_filters=incoming_vertex_filters
    )
    print("read_incoming_vertices_with_inedges")
    print_list(read_incoming_vertices_with_inedges)

    read_outgoing_vertices_with_inedges = await client.vertex.read_outgoing_vertices_with_inedges(
        starting_vertex_filters=starting_vertex_filters,
        # in_edge_filters=edge_filters,
        outv_filters=outgoing_vertex_filters
    )
    print("read_outgoing_vertices_with_inedges")
    print_list(read_outgoing_vertices_with_inedges)

    read_bothv_with_inedges = await client.vertex.read_bothv_with_inedges(
        starting_vertex_filters=starting_vertex_filters,
        # in_edge_filters=edge_filters,
        # bothv_filters=outgoing_vertex_filters
    )
    print("read_bothv_with_inedges")
    print_list(read_bothv_with_inedges)

    # out_edges_of_vertices = await client.vertex.read_in_edges(
    #     has__label="Song",
    #     # fetch_incoming_vertices=True,
    #     # fetch_outgoing_vertices=True
    # )
    # print("out_edges_of_vertices", out_edges_of_vertices)


_client = InvanaClient("ws://localhost:8182/gremlin")

# _client.execute_query_as_sync("g.V().drop()")
# async_to_sync(test_queries(_client))
async_to_sync(test_queries_inedges(_client))
