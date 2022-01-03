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
from invana_py.events import QueryEvent, QueryResponseReceivedSuccessfullyEvent, \
    QueryResponseReceivedWithErrorEvent, QueryFinishedEvent, QueryResponseErrorReasonTypes
from invana_py.schema.janusgraph import JanusGraphSchema
from invana_py.gremlin.query import QueryKwargs2GremlinQuery
from invana_py.gremlin.structure import VertexCRUD, EdgeCRUD
from invana_py.gremlin.connection import DriverRemoteConnection
from invana_py.gremlin.reader import invana_graphson_reader
from invana_py.exceptions import InvalidGraphBackendError
import logging

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 180  # in seconds


class ConnectionStateTypes:
    CONNECTED = "CONNECTED"
    CONNECTING = "CONNECTING"
    RECONNECTING = "RECONNECTING"
    DISCONNECTING = "DISCONNECTING"
    DISCONNECTED = "DISCONNECTED"


class InvanaGraph:
    query_kwargs = QueryKwargs2GremlinQuery()
    SUPPORTED_GRAPH_BACKENDS = ['janusgraph', ]
    DEFAULT_GRAPH_BACKEND = 'janusgraph'
    CONNECTION_STATE = None
    connection = None
    g = None

    def __init__(self,
                 gremlin_url,
                 traversal_source='g',
                 strategies=None,
                 graph_backend=None,
                 read_only_mode=False,
                 timeout=None,
                 loop=None,
                 auth=None,
                 transport_kwargs=None,
                 **connection_kwargs):
        graph_backend = graph_backend.lower() if graph_backend else self.DEFAULT_GRAPH_BACKEND
        if graph_backend not in self.SUPPORTED_GRAPH_BACKENDS:
            raise InvalidGraphBackendError()
        self.gremlin_url = gremlin_url
        self.traversal_source = traversal_source
        self.strategies = strategies or []
        self.auth = auth
        self.loop = loop
        self.timeout = timeout or DEFAULT_TIMEOUT
        if graph_backend == "janusgraph":
            self.schema = JanusGraphSchema(self)
        else:
            raise InvalidGraphBackendError()
        if read_only_mode:
            self.strategies.append(ReadOnlyStrategy())

        self.connection_kwargs = connection_kwargs
        self.transport_kwargs = transport_kwargs or {"call_from_event_loop": True}
        # await self.connect()
        self.vertex = VertexCRUD(self)
        self.edge = EdgeCRUD(self)

    async def connect(self):
        self.update_connection_state(ConnectionStateTypes.CONNECTING)
        self.connection = DriverRemoteConnection(
            self.gremlin_url,
            traversal_source=self.traversal_source,
            graphson_reader=invana_graphson_reader,
            **self.transport_kwargs
        )
        self.g = traversal().withRemote(self.connection)
        if self.strategies.__len__() > 0:
            self.g = self.g.withStrategies(*self.strategies)
        self.update_connection_state(ConnectionStateTypes.CONNECTED)

    async def reconnect(self):
        self.update_connection_state(ConnectionStateTypes.RECONNECTING)
        await self.connect()

    async def close_connection(self) -> None:
        self.update_connection_state(ConnectionStateTypes.DISCONNECTING)
        self.connection.client.close()
        self.update_connection_state(ConnectionStateTypes.DISCONNECTED)

    def update_connection_state(self, new_state):
        self.CONNECTION_STATE = new_state
        logger.debug(f"graph connector updated to state : {self.CONNECTION_STATE}")

    @staticmethod
    def determine_response_error_reason(error_string):
        if "with error 597: No signature of method" in error_string:
            return QueryResponseErrorReasonTypes.INVALID_QUERY
        return QueryResponseErrorReasonTypes.OTHER

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
    def get_query_with_strategies(self, query_string):
        if self.strategies.__len__() > 0:
            strategy_prefix = self.get_strategies_object_to_string()
            query_string = query_string.replace("g.", strategy_prefix, 1)
        return query_string

    async def execute_query(self, query_string, timeout=None) -> any:
        query_string = self.get_query_with_strategies(query_string)
        logger.info("Executing query : {}".format(query_string))
        timeout = timeout if timeout else self.timeout
        request_options = {"evaluationTimeout": timeout}
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

    async def execute_query_with_callback(self, query_string, callback, finished_callback=None, timeout=None, ) -> any:
        query_string = self.get_query_with_strategies(query_string)
        logger.info("Executing query : {}".format(query_string))
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
