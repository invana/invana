from aiohttp import ServerDisconnectedError, ClientConnectorError
from gremlin_python.process.anonymous_traversal import traversal
from gremlin_python.process.strategies import ReadOnlyStrategy
from gremlin_python.driver.protocol import GremlinServerError
from gremlin_python.driver.driver_remote_connection import DriverRemoteConnection as _DriverRemoteConnection
from .request import QueryRequest
from .constants import GremlinServerErrorStatusCodes, ConnectionStateTypes
from invana_py.traversal.traversal import InvanaTraversalSource
from .utils import read_from_result_set_with_callback, read_from_result_set_with_out_callback
from ..serializer.reader import INVANA_DESERIALIZER_MAP
from gremlin_python.structure.io.graphsonV3d0 import GraphSONReader
import logging

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 180 * 1000  # in seconds


class DriverRemoteConnection(_DriverRemoteConnection):

    @property
    def client(self):
        return self._client


class GremlinConnector:

    def __init__(self, gremlin_url: str,
                 traversal_source: str = 'g',
                 strategies=None,
                 read_only_mode: bool = False,
                 timeout: int = DEFAULT_TIMEOUT,
                 graph_traversal_source_cls=InvanaTraversalSource,
                 call_from_event_loop=True,
                 deserializer_map=None,
                 auth=None,
                 **transport_kwargs):
        """

        :param gremlin_url:
        :param traversal_source:
        :param strategies:
        :param read_only_mode:
        :param timeout: in milliseconds
        :param graph_traversal_source_cls:
        :param call_from_event_loop:
        :param deserializer_map:
        :param auth:
        :param transport_kwargs:
        """

        self.CONNECTION_STATE = None
        self.connection = None
        self.g = None
        self.gremlin_url = gremlin_url
        self.traversal_source = traversal_source
        self.strategies = strategies or []
        self.auth = auth
        self.graph_traversal_source_cls = graph_traversal_source_cls
        self.timeout = timeout
        if read_only_mode:
            self.strategies.append(ReadOnlyStrategy())
        if call_from_event_loop:
            transport_kwargs['call_from_event_loop'] = call_from_event_loop
        self.transport_kwargs = transport_kwargs
        INVANA_DESERIALIZER_MAP.update(deserializer_map or {})
        self.deserializer_map = INVANA_DESERIALIZER_MAP
        self.connect()

    def connect(self):
        self.update_connection_state(ConnectionStateTypes.CONNECTING)
        self.connection = DriverRemoteConnection(
            self.gremlin_url,
            traversal_source=self.traversal_source,
            graphson_reader=GraphSONReader(deserializer_map=self.deserializer_map),
            **self.transport_kwargs
        )
        self.g = traversal(self.graph_traversal_source_cls).withRemote(self.connection)
        if self.strategies.__len__() > 0:
            self.g = self.g.withStrategies(*self.strategies)
        self.update_connection_state(ConnectionStateTypes.CONNECTED)

    def reconnect(self):
        self.update_connection_state(ConnectionStateTypes.RECONNECTING)
        self.connect()

    def close(self) -> None:
        self.update_connection_state(ConnectionStateTypes.DISCONNECTING)
        self.connection.client.close()
        self.update_connection_state(ConnectionStateTypes.DISCONNECTED)

    def update_connection_state(self, new_state):
        self.CONNECTION_STATE = new_state
        logger.debug(f"GraphConnector state updated to : {self.CONNECTION_STATE}")

    def convert_strategies_object_to_string(self) -> str:
        graph_strategies_str = "g.withStrategies("
        for strategy in self.strategies:
            strategy_kwargs = ""
            for k, v in strategy.__dict__['configuration'].items():
                strategy_kwargs += f"{k}:'{v}'," if type(v) is str else f"{k}:{v},"
            strategy_kwargs = strategy_kwargs.rstrip(",")
            graph_strategies_str += f"new {strategy.__dict__['strategy_name']}({strategy_kwargs})"
        graph_strategies_str += ")."
        return graph_strategies_str

    def add_strategies_to_query(self, query_string):
        if self.strategies.__len__() > 0:
            strategy_prefix = self.convert_strategies_object_to_string()
            query_string = query_string.replace("g.", strategy_prefix, 1)
        return query_string

    @staticmethod
    def process_error_exception(exception: GremlinServerError):
        gremlin_server_error = getattr(GremlinServerErrorStatusCodes, f"ERROR_{exception.status_code}")
        return exception.status_code, gremlin_server_error

    def _execute_query(self, query: str,
                       timeout: int = None,
                       callback=None,
                       finished_callback=None,
                       raise_exception: bool = False) -> any:
        """

        :param query:
        :param timeout:
        :param callback:
        :param finished_callback:
        :param raise_exception: When set to False, no exception will be raised.
        :return:
        """

        query_string = self.add_strategies_to_query(query)
        timeout = timeout if timeout else self.timeout
        request_options = {"evaluationTimeout": timeout}
        request = QueryRequest(query)
        try:
            result_set = self.connection.client.submitAsync(query_string, request_options=request_options).result()
            if callback:
                read_from_result_set_with_callback(result_set, callback, request, finished_callback=finished_callback)
            else:
                response = read_from_result_set_with_out_callback(result_set, request)
                if finished_callback:
                    finished_callback()
                return response
        except GremlinServerError as e:
            request.response_received_but_failed(e)
            request.finished_with_failure(e)
            status_code, gremlin_server_error = self.process_error_exception(e)
            e.args = [f"Failed to execute {request} with reason: {status_code}:{gremlin_server_error}"
                      f" and error message {e.__str__()}"]
            if raise_exception is True:
                raise e
        except ServerDisconnectedError as e:
            request.server_disconnected_error(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise Exception(f"Failed to execute {request} with error message {e.__str__()}")
        except RuntimeError as e:
            e.args = [f"Failed to execute {request} with error message {e.__str__()}"]
            request.runtime_error(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise e
        except ClientConnectorError as e:
            e.args = [f"Failed to execute {request} with error message {e.__str__()}"]
            request.client_connection_error(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise e
        except Exception as e:
            e.args = [f"Failed to execute {request} with error message {e.__str__()}"]
            request.response_received_but_failed(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise e

    def execute_query(self, query: str, timeout: int = None, raise_exception: bool = False,
                      finished_callback=None) -> any:
        """

        :param query:
        :param timeout:
        :param raise_exception: When set to False, no exception will be raised.
        :param finished_callback:
        :return:
        """
        return self._execute_query(query, timeout=timeout, raise_exception=raise_exception,
                                   finished_callback=finished_callback)

    def execute_query_with_callback(self, query: str, callback, timeout=None, raise_exception: bool = False,
                                    finished_callback=None) -> None:
        self._execute_query(query, callback=callback, timeout=timeout,
                            raise_exception=raise_exception, finished_callback=finished_callback)
