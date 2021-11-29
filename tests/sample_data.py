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
VERTICES_SAMPLES = [
    {
        "label": "Star",
        "properties": {
            "name": "Sun",
            "mass_in_kgs": 1989000000000000000000000000000,
            "radius_in_kms": 696340
        }
    },
    {
        "label": "Planet",
        "properties": {
            "name": "Earth",
            "mass_in_kgs": 5972000000000000000000000,
            "radius_in_kms": 6371
        }
    },
    {
        "label": "Planet",
        "properties": {
            "name": "Mars",
            "mass_in_kgs": 641700000000000000000000,
            "radius_in_kms": 3396
        }
    },
    {
        "label": "Satellite",
        "properties": {
            "name": "Moon",
            "mass_in_kgs": 73476730900000000000000
        }
    },
    {
        "label": "Satellite",
        "properties": {
            "name": "Phobos",
            "mean_radius": 11
        }
    }, {
        "label": "Satellite",
        "properties": {
            "name": "Deimos",
            "mean_radius": 6
        }
    }
]

EDGES_SAMPLES = [
    {
        "label": "has_satellite",
        "properties": {
            "distance_in_kms": 384400
        },
        "from_vertex_filters": {
            "has__label": "Planet",
            "has__name": "Earth"
        },
        "to_vertex_filters": {
            "has__label": "Satellite",
            "has__name": "Moon"
        }
    },
    {
        "label": "has_satellite",
        "properties": {
            "distance_in_kms": 6000

        },
        "from_vertex_filters": {
            "has__label": "Planet",
            "has__name": "Mars"
        },
        "to_vertex_filters": {
            "has__label": "Satellite",
            "has__name": "Phobos"
        }
    },
    {
        "label": "has_satellite",
        "properties": {
            "distance_in_kms": 23458
        },
        "from_vertex_filters": {
            "has__label": "Planet",
            "has__name": "Mars"
        },
        "to_vertex_filters": {
            "has__label": "Satellite",
            "has__name": "Deimos"
        }
    },
    {
        "label": "has_planet",
        "properties": {
            "distance_in_kms": 250000000
        },
        "from_vertex_filters": {
            "has__label": "Star",
            "has__name": "Sun"
        },
        "to_vertex_filters": {
            "has__label": "Planet",
            "has__name": "Mars"
        }
    },
    {
        "label": "has_planet",
        "properties": {
            "distance_in_kms": 152000000
        },
        "from_vertex_filters": {
            "has__label": "Star",
            "has__name": "Sun"
        },
        "to_vertex_filters": {
            "has__label": "Planet",
            "has__name": "Earth"
        }
    },
    {
        "label": "has_neighbor_planet",
        "properties": {
            "distance_in_kms": 378000000
        },
        "from_vertex_filters": {
            "has__label": "Planet",
            "has__name": "Earth"
        },
        "to_vertex_filters": {
            "has__label": "Planet",
            "has__name": "Mars"
        }
    },
    {
        "label": "has_neighbor_planet",
        "properties": {
            "distance_in_kms": 378000000
        },
        "from_vertex_filters": {
            "has__label": "Planet",
            "has__name": "Mars"
        },
        "to_vertex_filters": {
            "has__label": "Planet",
            "has__name": "Earth"
        }
    },

]
