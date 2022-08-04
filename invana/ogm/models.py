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
from invana.ogm.properties import PropertyBase
from .. import graph


class Direction:
    OUTGOING = "OUTGOING"
    INCOMING = "INCOMING"
    UNDIRECTED = "UNDIRECTED"


class PropertyManager:

    @classmethod
    def get_property_keys(cls, model):
        return [i for i in model.__dict__.keys() if i[:1] != '_' and isinstance(getattr(model, i), PropertyBase)]

    @classmethod
    def get_relationship_keys(cls, model):
        return [i for i in model.__dict__.keys() if i[:1] != '_' and isinstance(getattr(model, i), PropertyBase)]

        # return [i for i in model.__dict__.keys() if i[:1] != '_'
        #         and isinstance(getattr(model, i), (RelationshipUndirected, RelationshipFrom, RelationshipTo,))]

    @classmethod
    def get_properties(cls, model):
        property_keys = cls.get_property_keys(model)
        property_definitions = [getattr(model, prop_key) for prop_key in property_keys]
        return dict(zip(property_keys, property_definitions))

    @classmethod
    def get_relationships(cls, model):
        keys = cls.get_relationship_keys(model)
        relationship_definitions = [getattr(model, k) for k in keys]
        return dict(zip(keys, relationship_definitions))


class ModelMetaBase(type):

    def __new__(mcs, name, bases, attrs):
        super_new = super().__new__
        # Also ensure initialization is only performed for subclasses of Model
        # (excluding Model class itself).

        model_class = super_new(ModelMetaBase, name, bases, attrs)

        # parents = [b for b in bases if isinstance(b, ModelMetaBase)]
        # if not parents:
        #     return super_new(mcs, name, bases, attrs)
        # model_base_cls = bases[0]

        if hasattr(model_class, '__abstract__'):
            delattr(model_class, '__abstract__')
        else:

            if "__label__" not in attrs:
                # generate name for node/relationship
                model_class.__label__ = name if issubclass(model_class, NodeModel) else convert_to_camel_case(name)
            model_class.__graph__ = graph

            # TODO - also find queryset managers like objects
            model_class.__all_properties__ = PropertyManager.get_properties(model_class)
            model_class.__all_relationships__ = PropertyManager.get_relationships(model_class)

            model_class.objects = model_class.objects(graph, model_class)
        return model_class


class ModelBase(metaclass=ModelMetaBase):
    __label__ = None
    __graph__ = None
    __abstract__ = True

    @classmethod
    def get_property_keys(cls):
        return cls.__all_properties__.keys()

    @classmethod
    def get_properties(cls):
        return cls.__all_properties__

    def __eq__(self, other):
        if not isinstance(other, (NodeModel,)):
            return False
        if hasattr(self, 'id') and hasattr(other, 'id'):
            return self.id == other.id
        return False

    def __ne__(self, other):
        return not self.__eq__(other)


class NodeModel(ModelBase):
    """
    class Meta:
        invana = None
    """
    objects = NodeModalQuerySet
    __abstract__ = True

    @classmethod
    def get_schema(cls):
        return graph.backend.schame_reader.get_vertex_schema(cls.__label__)

    # __label__ = None
    # __graph__ = None


class RelationshipModel(ModelBase):
    objects = RelationshipModalQuerySet
    __abstract__ = True

    # __label__ = None
    # __graph__ = None

    @classmethod
    def get_schema(cls):
        return graph.backend.schame_reader.get_edge_schema(cls.__label__)

    # @classmethod
    # def get_property_keys(cls):
    #     return cls.__all_properties__.keys()
    #
    # @classmethod
    # def get_properties(cls):
    #     return cls.__all_properties__
    #
    # def __eq__(self, other):
    #     if not isinstance(other, (RelationshipModel,)):
    #         return False
    #     if hasattr(self, 'id') and hasattr(other, 'id'):
    #         return self.id == other.id
    #     return False
    #
    # def __ne__(self, other):
    #     return not self.__eq__(other)


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


RelationshipTo = lambda model, relationship_model, cardinality=None: create_node_relationship_manager(model,
                                                                                                      relationship_model,
                                                                                                      Direction.OUTGOING,
                                                                                                      cardinality)

RelationshipFrom = lambda model, relationship_model, cardinality=None: create_node_relationship_manager(model,
                                                                                                        relationship_model,
                                                                                                        Direction.INCOMING,
                                                                                                        cardinality)

RelationshipUndirected = lambda model, relationship_model, cardinality=None: create_node_relationship_manager(model,
                                                                                                              relationship_model,
                                                                                                              Direction.UNDIRECTED,
                                                                                                              cardinality)
