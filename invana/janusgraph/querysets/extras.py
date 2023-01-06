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

from invana.gremlin.connector import GremlinConnector
from invana.base.querysets import QuerySetBase


# https://gist.github.com/disruptek/98ed066933d05f22850329c5efc1d7b4

class JanusGraphExtrasQuerySet(QuerySetBase):

    def get_open_instances(self):
        query = """
mgmt = graph.openManagement()
mgmt.getOpenInstances()        
"""
        return self.connector.execute_query(query)

    def get_open_transactions_size(self):
        query = "graph.getOpenTransactions().size()"
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

 