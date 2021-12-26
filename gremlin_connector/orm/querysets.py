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


class QuerySetBase:
    crud_cls = None

    def __init__(self, gremlin_connector):
        self.gremlin_connector = gremlin_connector


class VertexQuerySet(QuerySetBase):
    crud_cls = VertexCRUD

    def __init__(self, gremlin_connector, model):
        super(VertexQuerySet, self).__init__(gremlin_connector)
        self.crud = self.crud_cls(self.gremlin_connector)

        self.model = model

    def create(self, **kwargs):
        result = self.crud.create(self.model.label_name, properties=kwargs)
        return result

    def read_one(self, **query_kwargs):
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.read_one(**query_kwargs)

    def read_many(self, **query_kwargs):
        query_kwargs['has__label'] = self.model.label_name
        return self.crud.read_many(**query_kwargs)


class EdgeQuerySet(QuerySetBase):
    crud_cls = EdgeCRUD
