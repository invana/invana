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

from invana.ogm.model_querysets import NodeModalQuerySet, RelationshipModalQuerySet
from invana.ogm.utils import convert_to_camel_case
from invana.ogm.properties import FieldBase
from .. import graph


class Direction:
    OUTGOING = "OUTGOING"
    INCOMING = "INCOMING"
    UNDIRECTED = "UNDIRECTED"


class ModelMetaBase(type):

    def __new__(mcs, name, bases, attrs):
        super_new = super().__new__
        # Also ensure initialization is only performed for subclasses of Model
        # (excluding Model class itself).
        parents = [b for b in bases if isinstance(b, ModelMetaBase)]
        if not parents:
            return super_new(mcs, name, bases, attrs)
        model_base_cls = bases[0]
        if "__label__" not in attrs:
            # generate name for node/relationship
            attrs['__label__'] = name if model_base_cls.__name__ == "NodeModel" else convert_to_camel_case(name)
        attrs['__graph__'] = graph
        model_class = super_new(mcs, name, bases, attrs)
        model_class.objects = model_base_cls.objects(graph, model_class)
        return model_class


class NodeModel(metaclass=ModelMetaBase):
    """
    class Meta:
        invana = None
    """
    objects = NodeModalQuerySet
    __label__ = None
    __graph__ = None

    # graph = None
    # label_name = None
    # type = "VERTEX"

    @classmethod
    def get_schema(cls):
        return graph.backend.schame_reader.get_vertex_schema(cls.__label__)

    @classmethod
    def get_property_keys(cls):
        return [i for i in cls.__dict__.keys() if i[:1] != '_' and isinstance(getattr(cls, i), FieldBase)]

    @classmethod
    def get_properties(cls):
        property_keys = cls.get_property_keys()
        property_definitions = [getattr(cls, prop_key) for prop_key in property_keys]
        return dict(zip(property_keys, property_definitions))

    def __eq__(self, other):
        if not isinstance(other, (NodeModel,)):
            return False
        if hasattr(self, 'id') and hasattr(other, 'id'):
            return self.id == other.id
        return False

    def __ne__(self, other):
        return not self.__eq__(other)


class RelationshipModel(metaclass=ModelMetaBase):
    objects = RelationshipModalQuerySet
    __label__ = None
    __graph__ = None

    # graph = None
    # label_name = None
    # type = "EDGE"

    @classmethod
    def get_schema(cls):
        return graph.backend.schame_reader.get_edge_schema(cls.__label__)

    @classmethod
    def get_property_keys(cls):
        return [i for i in cls.__dict__.keys() if i[:1] != '_' and isinstance(getattr(cls, i), FieldBase)]

    @classmethod
    def get_properties(cls):
        property_keys = cls.get_property_keys()
        property_definitions = [getattr(cls, prop_key) for prop_key in property_keys]
        return dict(zip(property_keys, property_definitions))

    def __eq__(self, other):
        if not isinstance(other, (RelationshipModel,)):
            return False
        if hasattr(self, 'id') and hasattr(other, 'id'):
            return self.id == other.id
        return False

    def __ne__(self, other):
        return not self.__eq__(other)


class NodeRelationshipQuerySet:

    def __init__(self, model: [NodeModel], direction, relationship_model: [RelationshipModel], cardinality):
        self.model = model
        self.direction = direction
        self.relationship_model = relationship_model
        self.cardinality = cardinality
        self.queryset = RelationshipModalQuerySet(graph, relationship_model)

    def add_relationship(self, node, **properties):
        pass

    def remove_relationship(self):
        pass

    def has_relationship(self):
        pass

    def update_relationship(self):
        pass


def create_node_relationship_manager(model, relationship_model, direction, cardinality=None):
    if not issubclass(model, (str, NodeModel)):
        raise ValueError(f'model must be a NodeModel or str; got {repr(model)}')

    if not issubclass(relationship_model, (RelationshipModel,)):
        raise ValueError(f'relationship_model must be a RelationshipModel instance; got {repr(relationship_model)}')

    return NodeRelationshipQuerySet(model, relationship_model, direction, cardinality=cardinality)


def RelationshipTo(model, relationship_model, cardinality=None):
    return create_node_relationship_manager(model, relationship_model, Direction.OUTGOING, cardinality)


def RelationshipFrom(model, relationship_model, cardinality=None):
    return create_node_relationship_manager(model, relationship_model, Direction.INCOMING, cardinality)
