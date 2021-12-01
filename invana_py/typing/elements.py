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


class Property:
    key = None
    value = None


class Node:
    id = None
    label = None
    properties = []

    def __init__(self, _id, label, properties=None):
        self.id = _id
        self.label = label
        self.properties = properties or []

    def __repr__(self):
        property_string = "" if self.properties.__len__() == 0 else f"properties={self.properties}"
        return f'<Node id="{self.id}" label="{self.label}" {property_string}>'


class RelationShip:
    id = None
    label = None
    properties = []

    inv = None
    outv = None

    def __init__(self, _id, label,  outv, inv, properties=None):
        self.id = _id
        self.label = label
        self.inv = inv
        self.outv = outv
        self.properties = properties or []

    def __repr__(self):
        property_string = "" if self.properties.__len__() == 0 else f"properties={self.properties}"
        return f'<RelationShip id="{self.id}" ' \
               f'{self.outv.id}:{self.outv.label} -> {self.label} -> {self.inv.id}:{self.inv.label} ' \
               f'{property_string}>'
