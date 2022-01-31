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

from invana.backends.janusgraph.indexes import IndexQueryBuilder
from invana.backends.janusgraph.schema import JanusGraphSchemaCreate, JanusGraphSchemaReader
from invana.connector import GremlinConnector
from invana.ogm.indexes import MixedIndex, CompositeIndex


# https://gist.github.com/disruptek/98ed066933d05f22850329c5efc1d7b4

class GraphBackendManagement:

    def __init__(self, connector: GremlinConnector):
        self.connector = connector
        self.index_creator = IndexQueryBuilder()
        self.schema_creator = JanusGraphSchemaCreate()
        self.schema_reader = JanusGraphSchemaReader(connector)

    def get_open_instances(self):
        query = """
mgmt = graph.openManagement()
mgmt.getOpenInstances()        
"""
        return self.connector.execute_query(query)

    def get_open_transactions_size(self):
        query = """
graph.getOpenTransactions().size() 
"""
        return self.connector.execute_query(query)

    def rollback_open_transactions(self, i_understand=False):
        """
        https://gist.github.com/disruptek/98ed066933d05f22850329c5efc1d7b4
        :return:
        """
        if i_understand is not True:
            raise Exception("This step will roll back all transactions, "
                            "Please pass i_understand=True if you understand what this means,"
                            "otherwise this step cannot be proceeded further.")

        query = """
size = graph.getOpenTransactions().size()
if(size>0) {for(i=0;i<size;i++) {graph.getOpenTransactions().getAt(0).rollback()}}
graph.getOpenTransactions()        
        """
        return self.connector.execute_query(query)

    def create_model(self, model):
        return self.schema_creator.create_model(model)

    def create_indexes_from_model(self, model, timeout=None):
        indexes = model.indexes
        model_indexes = []
        for index in indexes:
            if isinstance(index, CompositeIndex):
                model_index = CompositeIndex(*index.property_keys, label=model.label_name)
                model_indexes.append(model_index)
            elif isinstance(index, MixedIndex):
                model_index = MixedIndex(*index.property_keys, label=model.label_name)
                model_indexes.append(model_index)
        return self.create_indexes(model_indexes, timeout=timeout)

    def _create_index(self, property_keys, label=None, index_name=None,
                      index_type: ["Mixed", "Composite"] = None,
                      timeout=None):
        if index_type not in ["Mixed", "Composite"]:
            raise ValueError('index_type should be ["Mixed", "Composite"]')
        timeout = timeout if timeout else 60 * 30 * 1000  # ie., 30 minutes
        # check for open transactions
        has_open_transactions = self.get_open_transactions_size().data[0] > 1
        if has_open_transactions:
            raise Exception("Cannot create_index when there are open transactions ")

        query, index_name__ = self.index_creator.create_index_query(property_keys, label=label,
                                                                    index_type=index_type,
                                                                    index_name=index_name)
        query += self.index_creator.wait_for_index_query(index_name__)
        query += self.index_creator.reindex_query(index_name__)
        return self.connector.execute_query(query, timeout=timeout)

    def create_index(self, index: [MixedIndex, CompositeIndex], timeout=None):
        return self._create_index(*index.property_keys, label=index.label,
                                  index_type=index.index_type,
                                  index_name=index.index_name, timeout=timeout)

    def create_indexes(self, indexes, timeout=None):
        status = []
        for index in indexes:
            _ = self.create_index(index, timeout=timeout)
            status.append(_)
        return status

    def re_index(self, index: [MixedIndex, CompositeIndex, str], timeout=None):
        timeout = timeout if timeout else 60 * 30 * 1000  # ie., 30 minutes
        index_name = index if isinstance(index, str) else index.index_name
        query = self.index_creator.reindex_query(index_name)
        return self.connector.execute_query(query, timeout=timeout)
