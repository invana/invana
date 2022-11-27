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
import json


class PropertySchema:
    name = None
    cardinality = None
    type = None

    def __init__(self, name, type, cardinality=None):
        self.name = name
        self.type = type
        self.cardinality = cardinality

    def __repr__(self):
        return f"<PropertySchema name='{self.name}' type='{self.type}' cardinality='{self.cardinality}' />"

    def to_json(self):
        return {"name": self.name, "type": self.type, "cardinality": self.cardinality}


class LinkPath:
    outv_label = None
    inv_label = None

    def __init__(self, outv_label, inv_label):
        self.outv_label = outv_label
        self.inv_label = inv_label

    def __repr__(self):
        return f"<LinkPath outVLabel='{self.outv_label}' inVLabel='{self.inv_label}' />"

    def to_json(self):
        return {"outv_label": self.outv_label, "inv_label": self.inv_label}


class ElementSchemaBase:
    type = None
    name = None
    properties = None

    def add_property_schema(self, property_schema: PropertySchema):
        self.properties[property_schema.name] = property_schema

    def get_property_keys(self):
        return list(self.properties.keys())

    def to_json(self):
        raise NotImplementedError()


class VertexSchema(ElementSchemaBase):
    type = "VERTEX"
    partitioned = None
    static = None
    property_keys: list = None

    def __init__(self, name, partitioned=None, static=None):
        self.name = name
        self.partitioned = json.loads(partitioned)
        self.static = json.loads(static)
        self.properties = {}
        self.property_keys = []

    def __repr__(self):
        return f"<VertexSchema name='{self.name}' partitioned={self.partitioned} static={self.static} />"

    def properties_as_list(self):
        return list(self.properties.values())

    def to_json(self):
        return {
            "name": self.name,
            "type": self.type,
            "partitioned": self.partitioned,
            "static": self.static,
            "properties": [property_data.to_json() for property_data in self.properties_as_list()],
            "property_keys": self.property_keys
        }


class EdgeSchema(ElementSchemaBase):
    type = "EDGE"
    unidirected = None
    directed = None
    multiplicity = None
    link_paths: list = None
    property_keys: list = None

    def __init__(self, name, unidirected=None, directed=None, multiplicity=None, link_paths=None):
        self.name = name
        self.unidirected = json.loads(unidirected)
        self.directed = json.loads(directed)
        self.multiplicity = multiplicity
        self.properties = {}
        self.link_paths = link_paths or []
        self.property_keys = []

    def __repr__(self):
        return f"<EdgeSchema name='{self.name}' unidirected={self.unidirected} " \
               f"directed={self.directed} multiplicity='{self.multiplicity}' />"

    def properties_as_list(self):
        return list(self.properties.values())

    def to_json(self):
        return {
            "name": self.name,
            "type": self.type,
            "unidirected": self.unidirected,
            "directed": self.directed,
            "multiplicity": self.multiplicity,
            "properties": [property_data.to_json() for property_data in self.properties_as_list()],
            "property_keys": self.property_keys,
            "link_paths": [path.to_json() for path in self.link_paths]
        }
