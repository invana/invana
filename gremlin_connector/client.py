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
#
from gremlin_python.process.anonymous_traversal import traversal
from gremlin_python.process.strategies import ReadOnlyStrategy
from gremlin_connector.dbs.janusgraph import JanusGraphSchema
from gremlin_connector.gremlin.query import QueryKwargs2GremlinQuery
from gremlin_connector.gremlin.structure import VertexCRUD, EdgeCRUD
from gremlin_connector.gremlin.connection import DriverRemoteConnection
from gremlin_connector.gremlin.reader import invana_graphson_reader
import logging

logger = logging.getLogger(__name__)


class GremlinConnector:
    query_kwargs = QueryKwargs2GremlinQuery()

    def __init__(self, gremlin_url, traversal_source='g',
                 strategies=None,
                 read_only_mode=False,
                 auth=None, **connection_kwargs):
        self.gremlin_url = gremlin_url
        self.traversal_source = traversal_source
        self.strategies = strategies or []
        self.auth = auth
        self.connection = self.create_connection(gremlin_url, traversal_source, **connection_kwargs)
        self.g = traversal().withRemote(self.connection)
        if read_only_mode:
            self.strategies.append(ReadOnlyStrategy())
        if self.strategies.__len__() > 0:
            self.g = self.g.withStrategies(*self.strategies)
        self.vertex = VertexCRUD(self)
        self.edge = EdgeCRUD(self)
        self.schema = JanusGraphSchema(self)

    @staticmethod
    def create_connection(gremlin_url, traversal_source, **connection_kwargs) -> DriverRemoteConnection:
        return DriverRemoteConnection(
            gremlin_url,
            traversal_source=traversal_source,
            graphson_reader=invana_graphson_reader,
            **connection_kwargs
        )

    def close_connection(self) -> None:
        return self.connection.client.close()

    def get_strategies_object_to_string(self) -> str:
        graph_strategies_str = "g.withStrategies("
        for strategy in self.strategies:
            strategy_kwargs = ""
            for k, v in strategy.__dict__['configuration'].items():
                strategy_kwargs += f"{k}:'{v}'," if type(v) is str else f"{k}:{v},"
            strategy_kwargs = strategy_kwargs.rstrip(",")
            graph_strategies_str += f"new {strategy.__dict__['strategy_name']}({strategy_kwargs})"
        graph_strategies_str += ")."
        return graph_strategies_str

    def execute_query(self, query_string) -> any:
        if self.strategies.__len__() > 0:
            strategy_prefix = self.get_strategies_object_to_string()
            query_string = query_string.replace("g.", strategy_prefix, 1)
        logger.info("Running query : {}".format(query_string))
        return self.connection.client.submit(query_string).next()
