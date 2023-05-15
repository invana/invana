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
from gremlin_python.structure.graph import  Path as _Path

class PropertiesObject:

    def __repr__(self):
        __str = ''
        for k, v in self.__dict__.items():
            __str += f'{k}={v} '
        return __str

class Path(_Path):

    def to_json(self):
        return [obj.to_json() for obj in self.objects ]



class ElementBase:
    id = None
    label = None
    type = None

    def __init__(self, *args, **kwargs):
        self.properties = PropertiesObject()

    def to_json(self):
        return {"id": self.id, "type": self.type, "label": self.label, "properties": self.properties.__dict__}


class Node(ElementBase):
    type = "vertex"

    def __init__(self, _id, label, properties=None):
        super(Node, self).__init__(_id, label, properties=properties)
        self.id = _id
        self.label = label
        if properties:
            for k, v in properties.items():
                setattr(self.properties, k, v)

    def __repr__(self):
        return f'<Node:{self.label} id="{self.id}" {self.properties}>'

    def __short_repr__(self):
              return f'{self.label}::{self.id}'

class RelationShip(ElementBase):
    inv = None
    outv = None
    type = "edge"

    def __init__(self, _id, label, outv, inv, properties=None):
        super(RelationShip, self).__init__(_id, label, outv, inv, properties=properties)
        self.id = _id
        self.label = label
        self.inv = inv
        self.outv = outv
        if properties:
            for k, v in properties.items():
                setattr(self.properties, k, v)

    def __repr__(self):
        return f'<RelationShip:{self.label}::{self.id} ' \
                f'({self.outv.__short_repr__()}) -> {self.label} -> ({self.inv.__short_repr__()})' \
                f' {self.properties}>'

    def to_json(self):
        base_data = super(RelationShip, self).to_json()
        base_data['inv'] = self.inv.to_json()
        base_data['outv'] = self.outv.to_json()
        return base_data
