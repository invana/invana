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

from abc import ABC
from gremlin_python.process.traversal import Cardinality
from invana.gremlin.connector import GremlinConnector
from invana.helpers.utils import divide_chunks
from gremlin_python.process.translator import Order
from ..traversal.traversal import __
import abc
from invana.base.resultsets import QueryResultSetBase

class GremlinQueryResultSet(QueryResultSetBase):

    def __init__(self, traversal):
        self._traversal = traversal

    def get_traversal(self):
        return self._traversal

    #
    # def properties(self, *args) -> list:
    #     return self.get_traversal().properties(*args).toList()
    #
    # def values(self, *args) -> list:
    #     return self.get_traversal().values(*args).toList()
    #
    # def value_map(self, *args) -> list:
    #     return self.get_traversal().valueMap(*args).toList()

    def to_list(self, *args) -> list:
        return self.get_traversal().elementMap(*args).toList()

    def values_list(self, *args, flatten=False) -> list:
        _ = self.get_traversal().properties(*args).toList()
        if flatten is True:
            return _
        return divide_chunks(_, args.__len__())

    def update(self, **properties) -> list:
        return self.get_traversal().update_properties(**properties).elementMap().toList()

    def count(self):
        _ = self.get_traversal().count().toList()
        if _.__len__() > 0:
            return _[0]

    def drop(self):
        return self.get_traversal().drop().iterate()

    def order_by(self, property_name):
        """

        :param property_name:
        :return:
        """
        _ = self.get_traversal()
        order_string = Order.desc if property_name.startswith("-") else Order.asc
        _.order().by(property_name, order_string)
        return self

    def range(self, *args):
        self.get_traversal().range(*args)
        return self

