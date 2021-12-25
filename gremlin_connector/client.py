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
from gremlin_python.driver.resultset import ResultSet
from gremlin_python.process.anonymous_traversal import traversal
from gremlin_python.process.strategies import ReadOnlyStrategy

from gremlin_connector.events import QueryEvent, QueryResponseReceivedSuccessfullyEvent, \
    QueryResponseReceivedWithErrorEvent, QueryFinishedEvent, QueryResponseErrorReasonTypes
from gremlin_connector.schema.janusgraph import JanusGraphSchema
from gremlin_connector.gremlin.query import QueryKwargs2GremlinQuery
from gremlin_connector.gremlin.structure import VertexCRUD, EdgeCRUD
from gremlin_connector.gremlin.connection import DriverRemoteConnection
from gremlin_connector.gremlin.reader import invana_graphson_reader
from gremlin_connector.exceptions import InvalidGraphBackendError
from concurrent.futures import Future
import logging

logger = logging.getLogger(__name__)


class StateTypes:
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"


class GremlinConnector:
    query_kwargs = QueryKwargs2GremlinQuery()
    SUPPORTED_GRAPH_BACKENDS = ['janusgraph', ]
    DEFAULT_GRAPH_BACKEND = 'janusgraph'
    STATE = None

    def __init__(self, gremlin_url,
                 traversal_source='g',
                 strategies=None,
                 graph_backend=None,
                 read_only_mode=False,
                 auth=None, **connection_kwargs):
        graph_backend = graph_backend.lower() if graph_backend else self.DEFAULT_GRAPH_BACKEND
        if graph_backend not in self.SUPPORTED_GRAPH_BACKENDS:
            raise InvalidGraphBackendError()
        self.gremlin_url = gremlin_url
        self.traversal_source = traversal_source
        self.strategies = strategies or []
        self.auth = auth
        if graph_backend == "janusgraph":
            self.schema = JanusGraphSchema(self)
        else:
            raise InvalidGraphBackendError()
        self.connection = self.create_connection(gremlin_url, traversal_source, **connection_kwargs)
        self.g = traversal().withRemote(self.connection)
        if read_only_mode:
            self.strategies.append(ReadOnlyStrategy())
        if self.strategies.__len__() > 0:
            self.g = self.g.withStrategies(*self.strategies)
        self.vertex = VertexCRUD(self)
        self.edge = EdgeCRUD(self)

    def create_connection(self, gremlin_url, traversal_source, **connection_kwargs) -> DriverRemoteConnection:
        _ = DriverRemoteConnection(
            gremlin_url,
            traversal_source=traversal_source,
            graphson_reader=invana_graphson_reader,
            **connection_kwargs
        )
        self.update_state(StateTypes.CONNECTED)
        return _

    def update_state(self, new_state):
        self.STATE = new_state

    @staticmethod
    def determine_response_error_reason(error_string):
        if "with error 597: No signature of method" in error_string:
            return QueryResponseErrorReasonTypes.INVALID_QUERY
        return QueryResponseErrorReasonTypes.OTHER

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

    # def execute_query(self, query_string, timeout=None) -> any:
    #     if self.strategies.__len__() > 0:
    #         strategy_prefix = self.get_strategies_object_to_string()
    #         query_string = query_string.replace("g.", strategy_prefix, 1)
    #     logger.info("Running query : {}".format(query_string))
    #     request_options = {"evaluationTimeout": timeout} if timeout else {}
    #     return self.connection.client.submit(query_string, request_options=request_options).next()

    def execute_query(self, query_string, timeout=None) -> any:
        if self.strategies.__len__() > 0:
            strategy_prefix = self.get_strategies_object_to_string()
            query_string = query_string.replace("g.", strategy_prefix, 1)
        logger.info("Running query : {}".format(query_string))
        request_options = {"evaluationTimeout": timeout} if timeout else {}
        query_event = QueryEvent({"query_string": query_string})
        try:
            result = self.connection.client.submitAsync(query_string,
                                                        request_options=request_options).result().all().result()
            QueryResponseReceivedSuccessfullyEvent(query_event.event_id, query_event.get_elapsed_time())
            QueryFinishedEvent(query_event.event_id, query_event.get_elapsed_time())


        except Exception as e:
            logger.debug("Failed to execute the query : {query_string} with error {error}".format(
                query_string=query_string, error=e.__str__()))
            error_reason = self.determine_response_error_reason(e.__str__())
            QueryResponseReceivedWithErrorEvent(query_event.event_id, query_event.get_elapsed_time(),
                                                error_reason=error_reason,
                                                error_message=e.__str__())
            QueryFinishedEvent(query_event.event_id, query_event.get_elapsed_time())
            raise Exception(f"Failed to execute query with reason: {error_reason} and error message {e.__str__()}")
        return result

    def execute_query_with_callback(self, query_string, callback, finished_callback=None, timeout=None, ) -> any:
        if self.strategies.__len__() > 0:
            strategy_prefix = self.get_strategies_object_to_string()
            query_string = query_string.replace("g.", strategy_prefix, 1)
        logger.info("Running query : {}".format(query_string))
        request_options = {"evaluationTimeout": timeout} if timeout else {}
        result_set = self.connection.client.submitAsync(query_string, request_options=request_options).result()
        self.read_from_result_set(result_set, callback, finished_callback)

    @staticmethod
    def read_from_result_set(result_set, callback, finished_callback):

        def cb(f):
            try:
                f.result()
            except Exception as e:
                raise e
            else:
                while not result_set.stream.empty():
                    single_result = result_set.stream.get_nowait()
                    callback(single_result)

        result_set.done.add_done_callback(cb)

        if finished_callback:
            finished_callback()
