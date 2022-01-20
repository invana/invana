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

class PropertiesObject:

    def __repr__(self):
        __str = ''
        for k, v in self.__dict__.items():
            __str += f'{k}={v} '
        return __str


class ElementBase:
    id = None
    label = None

    def __init__(self, *args, **kwargs):
        self.properties = PropertiesObject()

    def to_json(self):
        return {"id": self.id, "label": self.label, "properties": self.properties.__dict__}


class Node(ElementBase):

    def __init__(self, _id, label, properties=None):
        super(Node, self).__init__(_id, label, properties=properties)
        self.id = _id
        self.label = label
        if properties:
            for k, v in properties.items():
                setattr(self.properties, k, v)

    def __repr__(self):
        return f'<Node:{self.label} id="{self.id}" {self.properties}>'

    def to_json(self):
        return {"id": self.id, "label": self.label, "properties": self.properties.__dict__}


class RelationShip(ElementBase):
    inv = None
    outv = None

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
        return f'<RelationShip:{self.label} id="{self.id}" ' \
               f'{self.outv.id}:{self.outv.label} -> {self.label} -> {self.inv.id}:{self.inv.label}' \
               f' {self.properties}>'
