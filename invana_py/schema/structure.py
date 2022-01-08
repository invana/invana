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


class ElementSchemaBase:
    type = None
    name = None
    properties = None

    def add_property_schema(self, property_schema: PropertySchema):
        self.properties[property_schema.name] = property_schema

    def get_property_keys(self):
        return list(self.properties.keys())


class VertexSchema(ElementSchemaBase):
    type = "VERTEX"
    partitioned = None
    static = None

    def __init__(self, name, partitioned=None, static=None):
        self.name = name
        self.partitioned = json.loads(partitioned)
        self.static = json.loads(static)
        self.properties = {}

    def __repr__(self):
        return f"<VertexSchema name='{self.name}' partitioned={self.partitioned} static={self.static} />"


class EdgeSchema(ElementSchemaBase):
    type = "EDGE"
    unidirected = None
    directed = None
    multiplicity = None

    def __init__(self, name, unidirected=None, directed=None, multiplicity=None):
        self.name = name
        self.unidirected = json.loads(unidirected)
        self.directed = json.loads(directed)
        self.multiplicity = multiplicity
        self.properties = {}

    def __repr__(self):
        return f"<EdgeSchema name='{self.name}' unidirected={self.unidirected} " \
               f"directed={self.directed} multiplicity='{self.multiplicity}' />"