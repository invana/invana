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

from sample_data import EDGES_SAMPLES, VERTICES_SAMPLES
from models import Star, Planet, Satellite, HasPlanet, HasSatellite, HasNeighborPlanet
from connection import graph


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
        print("====vertex", vtx_instance)

    for edge in EDGES_SAMPLES:
        from_vertex = None
        to_vertex = None
        if edge['from_vertex_filters']['label'] == "Star":
            del edge['from_vertex_filters']['label']
            from_vertex = Star.objects.get_or_none(**edge['from_vertex_filters'])
        elif edge['from_vertex_filters']['label'] == "Planet":
            del edge['from_vertex_filters']['label']
            from_vertex = Planet.objects.get_or_none(**edge['from_vertex_filters'])
        elif edge['from_vertex_filters']['label'] == "Satellite":
            del edge['from_vertex_filters']['label']
            from_vertex = Satellite.objects.get_or_none(**edge['from_vertex_filters'])

        if edge['to_vertex_filters']['label'] == "Star":
            del edge['to_vertex_filters']['label']
            to_vertex = Star.objects.get_or_none(**edge['to_vertex_filters'])
        elif edge['to_vertex_filters']['label'] == "Planet":
            del edge['to_vertex_filters']['label']
            to_vertex = Planet.objects.get_or_none(**edge['to_vertex_filters'])
        elif edge['to_vertex_filters']['label'] == "Satellite":
            del edge['to_vertex_filters']['label']
            to_vertex = Satellite.objects.get_or_none(**edge['to_vertex_filters'])

        if edge['label'] == "has_satellite":
            edge_data = HasSatellite.objects.create(
                from_vertex.id,
                to_vertex.id,
                **edge['properties']
            )
        elif edge['label'] == "has_planet":
            edge_data = HasPlanet.objects.create(
                from_vertex.id,
                to_vertex.id,
                **edge['properties']
            )
        elif edge['label'] == "has_neighbor_planet":
            edge_data = HasNeighborPlanet.objects.create(
                from_vertex.id,
                to_vertex.id,
                **edge['properties']
            )
        print("===edge_data", edge_data)


def flush_data():
    Star.objects.delete()
    Planet.objects.delete()
    Satellite.objects.delete()
    HasPlanet.objects.delete()
    HasSatellite.objects.delete()
    HasNeighborPlanet.objects.delete()


flush_data()
import_data()
graph.close()
