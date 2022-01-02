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
from gremlin_connector.ogm.fields import StringProperty, FloatProperty, IntegerProperty
from gremlin_connector.ogm.models import VertexModel, EdgeModel
from connection import gremlin_connector


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
