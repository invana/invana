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
from gremlin_connector.orm.models import VertexModel, EdgeModel
from gremlin_connector.orm.fields import StringProperty, DateTimeProperty, IntegerProperty, FloatProperty, \
    BooleanProperty
from sample_data import EDGES_SAMPLES, VERTICES_SAMPLES


def import_data():
    for vertex in VERTICES_SAMPLES:
        if vertex['label'] == "Star":
            vertex['properties']['mass_in_kgs'] = float(vertex['properties']['mass_in_kgs'])
            vtx_instance = Star.objects.create(**vertex['properties'])
        elif vertex['label'] == "Planet":
            vertex['properties']['mass_in_kgs'] = float(vertex['properties']['mass_in_kgs'])
            vtx_instance = Planet.objects.create(**vertex['properties'])
        elif vertex['label'] == "Satellite":
            if "mass_in_kgs" in vertex['properties']:
                vertex['properties']['mass_in_kgs'] = float(vertex['properties']['mass_in_kgs'])
            if "mean_radius" in vertex['properties']:
                vertex['properties']['mean_radius'] = float(vertex['properties']['mean_radius'])
            vtx_instance = Satellite.objects.create(**vertex['properties'])
        print("====ver", vtx_instance)

    for edge in EDGES_SAMPLES:
        from_vertex = None
        to_vertex = None
        if edge['from_vertex_filters']['has__label'] == "Star":
            from_vertex = Star.objects.read_one(**edge['from_vertex_filters'])
        elif edge['from_vertex_filters']['has__label'] == "Planet":
            from_vertex = Planet.objects.read_one(**edge['from_vertex_filters'])
        elif edge['from_vertex_filters']['has__label'] == "Satellite":
            from_vertex = Satellite.objects.read_one(**edge['from_vertex_filters'])

        if edge['to_vertex_filters']['has__label'] == "Star":
            to_vertex = Star.objects.read_one(**edge['to_vertex_filters'])
        elif edge['to_vertex_filters']['has__label'] == "Planet":
            to_vertex = Planet.objects.read_one(**edge['to_vertex_filters'])
        elif edge['to_vertex_filters']['has__label'] == "Satellite":
            to_vertex = Satellite.objects.read_one(**edge['to_vertex_filters'])

        if edge['label'] == "has_satellite":
            edge_data = HasSatellite.objects.create(
                from_vertex.id,
                to_vertex.id,
                properties=edge['properties']
            )
        elif edge['label'] == "has_planet":
            edge_data = HasPlanet.objects.create(
                from_vertex.id,
                to_vertex.id,
                properties=edge['properties']
            )
        elif edge['label'] == "has_neighbor_planet":
            edge_data = HasNeighborPlanet.objects.create(
                from_vertex.id,
                to_vertex.id,
                properties=edge['properties']
            )
        print("===edge_data", edge_data)


gremlin_connector = GremlinConnector("ws://megamind-ws:8182/gremlin")
gremlin_connector.vertex.delete_many(has__label__within=["Planet", "Satellite", "Star"])


class Star(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        'name': StringProperty(),
        'mass_in_kgs': FloatProperty(),
        'radius_in_kms': IntegerProperty(),
    }


class Planet(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        'name': StringProperty(),
        'mass_in_kgs': FloatProperty(),
        'radius_in_kms': IntegerProperty(),
    }


class Satellite(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        'name': StringProperty(),
        'mass_in_kgs': FloatProperty(allow_null=True),
        'mean_radius': FloatProperty(allow_null=True),
    }


class HasPlanet(EdgeModel):
    gremlin_connector = gremlin_connector
    properties = {
        'distance_in_kms': IntegerProperty(),
    }


class HasSatellite(EdgeModel):
    gremlin_connector = gremlin_connector
    properties = {
        'distance_in_kms': IntegerProperty(),
    }


class HasNeighborPlanet(EdgeModel):
    gremlin_connector = gremlin_connector
    properties = {
        'distance_in_kms': IntegerProperty(),
    }


# delete_data(_client)
import_data()
gremlin_connector.close_connection()
