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
import itertools

from itertools import islice


def generate_chunks_from_list(it, size):
    # https://stackoverflow.com/a/22045226
    it = iter(it)
    return list(iter(lambda: tuple(islice(it, size)), ()))


def create_id_object(**kwargs):
    if kwargs['@type'] == "g:Int64":
        return GInt64Item(**kwargs)

    if kwargs['@type'] == "janusgraph:RelationIdentifier":
        return RelationIdItem(**kwargs)


def create_element_map_object(**kwargs):
    if kwargs['@type'] == "g:Map":
        value = kwargs['@value']
        if isinstance(value, list):
            data = {"@value": {}}
            value_tuples = generate_chunks_from_list(value, 2)
            if "RelationIdentifier" in value_tuples[0][1]['@type']:
                data['@type'] = "g:Edge"
            else:
                data['@type'] = "g:Vertex"
            data['@value']['id'] = value_tuples[0][1]
            data['@value']['label'] = value_tuples[1][1]
            data['@value']['properties'] = {}
            property_tuples = value_tuples[2:] if data['@type'] == "g:Vertex" else value_tuples[4:]

            for i, v in enumerate(property_tuples):  # cos first two tuples are id and label
                prop_data = {}
                prop_data['@type'] = "g:Property"
                value = v[1]
                if isinstance(value, dict):
                    if isinstance(value['@value'], list):
                        value = value['@value'][0]
                    else:
                        value = value['@value']
                prop_data['@value'] = {"key": v[0], "value": value}
                data['@value']['properties'][v[0]] = prop_data
            if data['@type'] == "g:Edge":
                for v in value_tuples[2:4]:
                    if isinstance(v, tuple) and isinstance(v[0], dict):
                        if v[0]['@value'] == "IN":
                            data['@value']['inV'] = v[1]['@value'][1]
                            data['@value']['inVLabel'] = v[1]['@value'][3]
                        if v[0]['@value'] == "OUT":
                            data['@value']['outV'] = v[1]['@value'][1]
                            data['@value']['outVLabel'] = v[1]['@value'][3]

            if data['@type'] == "g:Vertex":
                return GVertexItem(**data)
            else:
                return GEdgeItem(**data)


def convert_to_objects(*_, **kwargs):
    if kwargs.get("@type") == "g:List":
        items = []
        for val in kwargs.get("@value", []):
            items.append(convert_to_objects(**val))
        return items
    elif kwargs.get("@type") == "g:Map":
        return create_element_map_object(**kwargs)
    elif kwargs.get("@type") == "g:Int64":
        return GInt64Item(**kwargs)
    elif kwargs.get("@type") == "g:Vertex":
        return GVertexItem(**kwargs)
    elif kwargs.get("@type") == "g:Edge":
        return GEdgeItem(**kwargs)
    elif kwargs.get("@type") == "g:Path":
        return GPathItem(**kwargs)
    else:
        raise Exception("Dont know how to serialise {} type data".format(kwargs.get("@type")))


class ItemBase:
    type = None

    def __init__(self, **kwargs):
        if self.type != kwargs.get("@type"):
            raise Exception("This item type should be initialised for type {}. But received ".format(
                self.type, kwargs.get("@type")))
        self.value = kwargs.get("@value")

    def as_dict(self):
        return {"@type": self.type, "@value": self.value}

    def __repr__(self):
        return "<{} value={}/>".format(self.type, self.value)

    def to_object(self, *_, **kwargs):
        if kwargs.get("@type") == "g:List":
            items = []
            for val in kwargs.get("@value", []):
                items.append(self.to_object(**val))
            return items
        elif kwargs.get("@type") == "g:Map":
            return create_element_map_object(**kwargs)


class GMapItem(ItemBase):
    type = "g:Map"

    def to_dict(self):
        return {
            "value": self.value,
            "type": self.type
        }


class GInt64Item(ItemBase):
    type = "g:Int64"

    def to_dict(self):
        return self.value


class GStringItem(ItemBase):
    type = "g:String"

    def to_dict(self):
        return self.value


class GListItem(ItemBase):
    type = "g:List"


class RelationIdItem(ItemBase):
    type = "janusgraph:RelationIdentifier"

    def __init__(self, **kwargs):
        super(RelationIdItem, self).__init__(**kwargs)
        if self.type != kwargs.get("@type"):
            raise Exception("This item type should be initialised for type {}. But received ".format(
                self.type, kwargs.get("@type")))
        self.to_object(**kwargs)

    def to_object(self, *_, **kwargs):
        self.value = kwargs['@value']['relationId']


class PropertyItemBase:
    _type = None  # This should be
    id = None
    label = None
    value = None

    @property
    def type(self):
        return self._type

    def __init__(self, **kwargs):
        if self.type != kwargs.get("@type"):
            raise Exception("This item type should be initialised for type {}. But received ".format(
                self.type, kwargs.get("@type")))
        self.to_object(**kwargs)

    def to_object(self, *_, **kwargs):
        value = kwargs['@value']
        if value.get('id'):
            self.id = value['id']['@value']['relationId']
        self.label = value['label']
        self.value = value['value']

    def to_dict(self):
        return {"label": self.label, "property_id": self.id, "value": self.value}

    def __repr__(self):
        return "<{} label={} value={} />".format(self.type, self.label, self.value)

    def __str__(self):
        return "{}={}".format(self.label, self.value)


class VertexPropertyItem(PropertyItemBase):
    _type = "g:VertexProperty"


class EdgePropertyItem(PropertyItemBase):
    _type = "g:EdgeProperty"


class GPropertyItem(PropertyItemBase):
    _type = "g:Property"
    label = None
    value = None

    def to_object(self, *_, **kwargs):
        value = kwargs['@value']
        self.label = value['key']
        self.value = value['value']

    def __repr__(self):
        return "<{} label={} value={} />".format(self.type, self.label, self.value)


class GraphElementItemBase(ItemBase):
    type = None
    _id = None
    label = None
    properties = []

    def __init__(self, **kwargs):
        super(GraphElementItemBase, self).__init__(**kwargs)
        self.to_object(**kwargs)

    def assign_properties(self, value):
        self.properties = []
        for property_name, property_data in value.get('properties', {}).items():
            if isinstance(property_data, list):
                for property_datum in property_data:
                    if property_datum['@type'] == "g:VertexProperty":
                        self.properties.append(VertexPropertyItem(**property_datum))
            elif property_data['@type'] == "g:Property":
                self.properties.append(GPropertyItem(**property_data))

    def to_object(self, *_, **kwargs):
        value = kwargs['@value']
        self._id = create_id_object(**value['id'])
        self.label = value['label']
        self.assign_properties(kwargs['@value'])

    @property
    def id(self):
        return self._id.value

    def to_dict(self):
        properties = {}
        for prop in self.properties:
            properties[prop.label] = prop.value

        return {
            "id": self.id,
            "label": self.label,
            "properties": properties
        }


class GVertexItem(GraphElementItemBase):
    type = "g:Vertex"

    def __repr__(self):
        return "<{} id={} label={} {}/>".format(
            self.type, self.id, self.label,
            " ".join([prop.__str__() for prop in self.properties]))


class GEdgeItem(GraphElementItemBase):
    type = "g:Edge"
    inv_label = None
    inv = None
    outv_label = None
    outv = None

    def to_object(self, *_, **kwargs):
        super(GEdgeItem, self).to_object(*_, **kwargs)
        self.assign_edge_details(kwargs['@value'])

    def assign_edge_details(self, value):
        if value.get("inVLabel") and value.get("outVLabel"):
            self.inv_label = value['inVLabel']
            self.inv = create_id_object(**value['inV'])
            self.outv_label = value['outVLabel']
            self.outv = create_id_object(**value['outV'])

    def __repr__(self):
        e_info = ""
        if self.outv and self.outv_label:
            e_info += "{}({})--".format(self.outv_label, self.outv.value)

        e_info += "{}".format(self.label)
        if self.inv:
            e_info += "-->{}({})".format(self.inv_label, self.inv.value)

        return "<{type} id={id} {e_info} {properties}/>".format(
            type=self.type, id=self.id, e_info=e_info,
            properties=" ".join([prop.__str__() for prop in self.properties]))

    def to_dict(self):
        data = super(GEdgeItem, self).to_dict()
        data['inv_label'] = self.inv_label
        data['inv'] = self.inv.value if self.inv else None
        data['outv_label'] = self.outv_label
        data['outv'] = self.outv.value if self.outv else None
        return data


class GPathItem:
    type = "g:Path"
    items = []

    def __init__(self, *_, **kwargs):
        self.items = self.to_object(*_, **kwargs)

    def to_object(self, *_, **kwargs):
        path_items = []
        for v in kwargs['@value']['objects']['@value']:
            path_items.append(convert_to_objects(**v))
        return path_items

    def __repr__(self):
        return "<{type} items={items}/>".format(type=self.type, items=self.items)

    def to_dict(self):
        return [d.to_dict() for d in self.items]


class ResultSet:

    def __init__(self, data=None, meta=None):
        self.data = convert_to_objects(**data) if data else None
        self.meta = GMapItem(**meta)

    def __repr__(self):
        return "<ResultSet meta={meta} data={data} />".format(data=self.data, meta=self.meta)

    @staticmethod
    def get_dict_or_original_value(d):
        try:
            return d.to_dict()
        except:
            return d

    def to_dict(self):
        return {
            "data": [self.get_dict_or_original_value(d) for d in self.data],
            "meta": self.meta.to_dict()
        }
