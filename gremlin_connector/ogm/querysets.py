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
from gremlin_connector.gremlin.structure import VertexCRUD, EdgeCRUD
from .decorators import dont_allow_has_label_kwargs
from .exceptions import FieldNotFoundError, ValidationError
from gremlin_connector.typing.elements import Node, RelationShip


class QuerySetBase:
    crud_cls = None
    model = None

    def __init__(self, gremlin_connector):
        self.gremlin_connector = gremlin_connector

    @staticmethod
    def get_validated_data(field_name, field_value, model):
        field = model.properties.get(field_name)
        if field is None:
            raise FieldNotFoundError(f"{field_name} doesn't exist in model '{model.__name__}'")

        validated_value = field.validate(field_value, field_name=field_name, model=model)
        return validated_value

    def validate_for_create(self, **properties):
        """

        :param properties:
        # :param update_mode: when update_mode is True, OGM will not expect all the properties
        :return:
        """
        validated_data = {}
        allowed_property_keys = list(self.model.properties.keys())
        for k, v in properties.items():
            if k not in allowed_property_keys:
                raise ValidationError(f"property {k} not allowed in {self.model.label_name}")
        for k, field in self.model.properties.items():
            _ = self.get_validated_data(k, properties.get(k), self.model)
            if _ is not None:
                validated_data[k] = _
        return validated_data

    def validate_for_update(self, **properties):
        """
        in update_mode, OGM will not expect all the properties

        :param properties:
        :return:
        """
        validated_data = {}
        allowed_property_keys = list(self.model.properties.keys())
        for k, v in properties.items():
            if k not in allowed_property_keys:
                raise ValidationError(f"property {k} not allowed in {self.model.label_name}")
        for k, v in properties.items():
            _ = self.get_validated_data(k, v, self.model)
            if _ is not None:
                validated_data[k] = _
        return validated_data

    def serialize_to_datatypes(self, element):
        if element and (isinstance(element, Node) or isinstance(element, RelationShip)):
            for k, field in self.model.properties.items():
                if hasattr(element.properties, k):
                    _ = self.get_validated_data(k, getattr(element.properties, k), self.model)
                    setattr(element.properties, k, _)
        return element

    def count(self, **query_kwargs):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.count(**query_kwargs)


class VertexQuerySet(QuerySetBase):
    crud_cls = VertexCRUD

    def __init__(self, gremlin_connector, model):
        super(VertexQuerySet, self).__init__(gremlin_connector)
        self.crud = self.crud_cls(self.gremlin_connector)
        self.model = model

    def create(self, **kwargs):
        validated_data = self.validate_for_create(**kwargs)
        result = self.crud.create(self.model.label_name, properties=validated_data)
        return self.serialize_to_datatypes(result)

    def get_or_create(self, **properties):
        result = self.crud.get_or_create(self.model.label_name, properties=properties)
        return self.serialize_to_datatypes(result)

    def read_one(self, **query_kwargs):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        result = self.crud.read_one(**query_kwargs)
        return self.serialize_to_datatypes(result)

    def read_many(self, **query_kwargs):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        result = self.crud.read_many(**query_kwargs)
        return [self.serialize_to_datatypes(res) for res in result]

    def update_one(self, query_kwargs=None, properties=None):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        validated_data = self.validate_for_update(**properties)
        result = self.crud.update_one(query_kwargs=query_kwargs, properties=validated_data)
        return self.serialize_to_datatypes(result)

    def update_many(self, query_kwargs=None, properties=None):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        validated_data = self.validate_for_update(**properties)
        result = self.crud.update_many(query_kwargs=query_kwargs, properties=validated_data)
        return [self.serialize_to_datatypes(res) for res in result]

    def delete_one(self, **query_kwargs):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.delete_one(**query_kwargs)

    def delete_many(self, **query_kwargs):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.delete_many(**query_kwargs)


class EdgeQuerySet(QuerySetBase):
    crud_cls = EdgeCRUD

    def __init__(self, gremlin_connector, model):
        super(EdgeQuerySet, self).__init__(gremlin_connector)
        self.crud = self.crud_cls(self.gremlin_connector)
        self.model = model

    def create(self, from_, to_, properties=None):
        properties = {} if properties is None else properties
        validated_data = self.validate_for_create(**properties)
        result = self.crud.create(self.model.label_name, from_, to_, properties=validated_data)
        return self.serialize_to_datatypes(result)

    def get_or_create(self, from_, to_, properties=None):
        result = self.crud.get_or_create(self.model.label_name, from_, to_, properties=properties)
        return self.serialize_to_datatypes(result)

    def read_one(self, from_=None, to_=None, **query_kwargs):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        result = self.crud.read_one(from_=from_, to_=to_, **query_kwargs)
        return self.serialize_to_datatypes(result)

    def read_many(self, from_=None, to_=None, **query_kwargs):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        result = self.crud.read_many(from_=from_, to_=to_, **query_kwargs)
        return [self.serialize_to_datatypes(res) for res in result]

    def update_one(self, from_=None, to_=None, query_kwargs=None, properties=None):
        dont_allow_has_label_kwargs(**query_kwargs)
        validated_data = self.validate_for_update(**properties)
        query_kwargs['has__label'] = self.model.label_name
        result = self.crud.update_one(from_=from_, to_=to_, query_kwargs=query_kwargs, properties=validated_data)
        return self.serialize_to_datatypes(result)

    def update_many(self, from_=None, to_=None, query_kwargs=None, properties=None):
        dont_allow_has_label_kwargs(**query_kwargs)
        validated_data = self.validate_for_update(**properties)
        query_kwargs['has__label'] = self.model.label_name
        result = self.crud.update_many(from_=from_, to_=to_, query_kwargs=query_kwargs, properties=validated_data)
        return [self.serialize_to_datatypes(res) for res in result]

    def delete_one(self, from_=None, to_=None, **query_kwargs):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.update_many(from_=from_, to_=to_, **query_kwargs)

    def delete_many(self, from_=None, to_=None, **query_kwargs):
        dont_allow_has_label_kwargs(**query_kwargs)
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.delete_many(from_=from_, to_=to_, **query_kwargs)
