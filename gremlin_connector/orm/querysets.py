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
from .exceptions import FieldNotFoundError


class QuerySetBase:
    crud_cls = None
    model = None

    @staticmethod
    def get_validated_data(field_name, field_value, model):
        field = model.fields.get(field_name)
        if field is None:
            raise FieldNotFoundError(f"{field_name} doesn't exist in model '{model.__name__}'")

        validated_value = field.validate(field_value, field_name=field_name)
        return validated_value

    def validate(self, **kwargs):
        validated_data = {}
        for k, v in kwargs.items():
            validated_data[k] = self.get_validated_data(k, v, self.model)
        return validated_data

    def __init__(self, gremlin_connector):
        self.gremlin_connector = gremlin_connector


class VertexQuerySet(QuerySetBase):
    crud_cls = VertexCRUD

    def __init__(self, gremlin_connector, model):
        super(VertexQuerySet, self).__init__(gremlin_connector)
        self.crud = self.crud_cls(self.gremlin_connector)
        self.model = model

    def create(self, **kwargs):
        validated_data = self.validate(**kwargs)
        result = self.crud.create(self.model.label_name, properties=validated_data)
        return result

    def read_one(self, **query_kwargs):
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.read_one(**query_kwargs)

    def get_or_create(self, **properties):
        validated_data = self.validate(**properties)
        return self.crud.get_or_create(self.model.label_name, properties=validated_data)

    def read_many(self, **query_kwargs):
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.read_many(**query_kwargs)

    def update_one(self, query_kwargs=None, properties=None):
        query_kwargs['has__label'] = self.model.label_name
        validated_data = self.validate(**properties)
        return self.crud.update_one(query_kwargs=query_kwargs, properties=validated_data)

    def update_many(self, query_kwargs=None, properties=None):
        query_kwargs['has__label'] = self.model.label_name
        validated_data = self.validate(**properties)
        return self.crud.update_many(query_kwargs=query_kwargs, properties=validated_data)

    def delete_one(self, **query_kwargs):
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.delete_one(**query_kwargs)

    def delete_many(self, **query_kwargs):
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.delete_many(**query_kwargs)


class EdgeQuerySet(QuerySetBase):
    crud_cls = EdgeCRUD

    def __init__(self, gremlin_connector, model):
        super(EdgeQuerySet, self).__init__(gremlin_connector)
        self.crud = self.crud_cls(self.gremlin_connector)
        self.model = model

    def create(self, from_, to_, properties=None):
        validated_data = self.validate(**properties)
        return self.crud.create(self.model.label_name, from_, to_, properties=validated_data)

    def read_one(self, from_=None, to_=None, **query_kwargs):
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.read_one(from_=from_, to_=to_, **query_kwargs)

    def get_or_create(self, from_, to_, properties=None):
        validated_data = self.validate(**properties)
        return self.crud.get_or_create(self.model.label_name, from_, to_, properties=validated_data)

    def read_many(self, from_=None, to_=None, **query_kwargs):
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.read_many(from_=from_, to_=to_, **query_kwargs)

    def update_one(self, from_=None, to_=None, query_kwargs=None, properties=None):
        validated_data = self.validate(**properties)
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.update_one(from_=from_, to_=to_, query_kwargs=query_kwargs, properties=validated_data)

    def update_many(self, from_=None, to_=None, query_kwargs=None, properties=None):
        validated_data = self.validate(**properties)
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.update_many(from_=from_, to_=to_, query_kwargs=query_kwargs, properties=validated_data)

    def delete_one(self, from_=None, to_=None, **query_kwargs):
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.update_many(from_=from_, to_=to_, **query_kwargs)

    def delete_many(self, from_=None, to_=None, **query_kwargs):
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.delete_many(from_=from_, to_=to_, **query_kwargs)
