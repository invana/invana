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
from gremlin_python.structure.graph import Vertex
from gremlin_python.process.graph_traversal import __
from gremlin_python.process.traversal import Cardinality
from gremlin_connector.utils import calculate_time
# from ..events import register_query_event
import abc


class CRUDBase(abc.ABC):

    def __init__(self, gremlin_connector):
        self.gremlin_connector = gremlin_connector

    @abc.abstractmethod
    def get_element_type(self):
        pass

    def filter_by_query_kwargs(self, element_type=None, g=None, **query_kwargs):
        return self.gremlin_connector.query_kwargs.process_query_kwargs(
            element_type=element_type or self.get_element_type(),
            g=g or self.gremlin_connector.g,
            **query_kwargs
        )

    def count(self, element_type=None, g=None, **query_kwargs):
        traversal = self.gremlin_connector.query_kwargs.process_query_kwargs(
            element_type=element_type or self.get_element_type(),
            g=g or self.gremlin_connector.g,
            **query_kwargs
        )
        return traversal.count().next()


class VertexCRUD(CRUDBase):

    def get_element_type(self):
        return "V"

    def create(self, label, properties=None):
        _ = self.gremlin_connector.g.addV(label)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        return _.next()

    # @calculate_time
    def read_one(self, **query_kwargs) -> Vertex:
        _ = self.filter_by_query_kwargs(pagination__limit=1, **query_kwargs)
        # register_query_event(_.__str__())
        result = _.elementMap().toList()
        return result[0] if result.__len__() > 0 else None

    def get_or_create(self, label, properties=None):
        properties = properties if properties else {}
        properties_kwargs = {}
        if label:
            properties_kwargs[f"has__label"] = label
        properties_kwargs.update({f"has__{k}": v for k, v in properties.items()})
        result = self.read_one(**properties_kwargs)
        if result:
            return result
        return self.create(label, properties=properties)

    def read_many(self, **query_kwargs) -> list:
        _ = self.filter_by_query_kwargs(**query_kwargs)
        # register_query_event(_.__str__())
        return _.elementMap().toList()

    def update_one(self, query_kwargs=None, properties=None):
        _ = self.filter_by_query_kwargs(pagination__limit=1, **query_kwargs)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        result = _.elementMap().toList()
        return result[0] if result.__len__() > 0 else None

    def update_many(self, query_kwargs=None, properties=None):
        _ = self.filter_by_query_kwargs(**query_kwargs)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        result = _.elementMap().toList()
        return result

    def delete_one(self, **query_kwargs):
        return self.filter_by_query_kwargs(pagination__limit=1, **query_kwargs).drop().iterate()

    def delete_many(self, **query_kwargs):
        return self.filter_by_query_kwargs(**query_kwargs).drop().iterate()


class EdgeCRUD(CRUDBase):

    def get_element_type(self):
        return "E"

    def filter_e_by_query_kwargs(self, from_=None, to_=None, **query_kwargs):
        if from_ and to_:
            _ = self.gremlin_connector.g.V(from_).outE()
            _ = self.filter_by_query_kwargs(g=_, **query_kwargs)
            getattr(_, "where")(__.inV().hasId(to_))
        elif from_ and not to_:
            _ = self.gremlin_connector.g.V(from_).outE()
            _ = self.filter_by_query_kwargs(g=_, **query_kwargs)
        elif not from_ and to_:
            _ = self.gremlin_connector.g.V(to_).inE()
            _ = self.filter_by_query_kwargs(g=_, **query_kwargs)
        else:
            _ = self.filter_by_query_kwargs(**query_kwargs)
        return _

    def create(self, label, from_, to_, properties=None):
        _ = self.gremlin_connector.g.addE(label).from_(__.V(from_)).to(__.V(to_))
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        return _.next()

    def read_one(self, from_=None, to_=None, **query_kwargs):
        _ = self.filter_e_by_query_kwargs(from_=from_, to_=to_, pagination__limit=1, **query_kwargs)
        result = _.elementMap().toList()
        return result[0] if result.__len__() > 0 else None

    def get_or_create(self, label, from_, to_, properties=None):
        properties = properties if properties else {}
        query_kwargs = {}
        if label:
            query_kwargs[f"has__label"] = label
        query_kwargs.update({f"has__{k}": v for k, v in properties.items()})
        result = self.read_one(from_=from_, to_=to_, **query_kwargs)
        if result:
            return result
        return self.create(label, from_, to_, properties=properties)

    def read_many(self, from_=None, to_=None, **query_kwargs):
        _ = self.filter_e_by_query_kwargs(from_=from_, to_=to_, **query_kwargs)
        result = _.elementMap().toList()
        return result

    def update_one(self, from_=None, to_=None, query_kwargs=None, properties=None):
        _ = self.filter_e_by_query_kwargs(from_=from_, to_=to_, pagination__limit=1, **query_kwargs)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        result = _.elementMap().toList()
        return result[0] if result.__len__() > 0 else None

    def update_many(self, from_=None, to_=None, query_kwargs=None, properties=None):
        _ = self.filter_e_by_query_kwargs(from_=from_, to_=to_, **query_kwargs)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        result = _.elementMap().toList()
        return result

    def delete_one(self, from_=None, to_=None, **query_kwargs):
        return self.filter_e_by_query_kwargs(from_=from_, to_=to_, pagination__limit=1, **query_kwargs).drop().iterate()

    def delete_many(self, from_=None, to_=None, **query_kwargs):
        return self.filter_e_by_query_kwargs(from_=from_, to_=to_, **query_kwargs).drop().iterate()
