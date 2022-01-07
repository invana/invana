from aiohttp import ServerDisconnectedError, ClientConnectorError
from gremlin_python.process.anonymous_traversal import traversal
from gremlin_python.process.strategies import ReadOnlyStrategy
from gremlin_python.driver.protocol import GremlinServerError
from gremlin_python.driver.driver_remote_connection import DriverRemoteConnection as _DriverRemoteConnection
# from invana_py.connector.events import QueryResponseReceivedSuccessfullyEvent, QueryFinishedEvent, \
#     QueryResponseReceivedWithErrorEvent, QueryEvent, QueryResponseErrorReasonTypes
from invana_py.connector.request import QueryRequest
from .constants import GremlinServerErrorStatusCodes, ConnectionStateTypes
from invana_py.connector.utils import read_from_result_set_with_callback, read_from_result_set_with_out_callback
import logging

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 180 * 1000  # in seconds


class DriverRemoteConnection(_DriverRemoteConnection):

    @property
    def client(self):
        return self._client


class GremlinConnector:
    CONNECTION_STATE = None
    connection = None
    g = None

    def __init__(self, gremlin_url: str,
                 traversal_source: str = 'g',
                 strategies=None,
                 read_only_mode: bool = False,
                 graphson_reader=None,
                 timeout: int = None,
                 call_from_event_loop=True,
                 auth=None, **transport_kwargs):
        """

        :param gremlin_url:
        :param traversal_source:
        :param strategies:
        :param read_only_mode:
        :param graphson_reader:
        :param timeout: in milliseconds
        :param auth:
        :param transport_kwargs:
        """
        self.gremlin_url = gremlin_url
        self.traversal_source = traversal_source
        self.strategies = strategies or []
        self.auth = auth
        self.timeout = timeout or DEFAULT_TIMEOUT
        self.graphson_reader = graphson_reader
        if read_only_mode:
            self.strategies.append(ReadOnlyStrategy())
        if call_from_event_loop:
            transport_kwargs['call_from_event_loop'] = call_from_event_loop
        self.transport_kwargs = transport_kwargs

        self.connect()

    def connect(self):
        self.update_connection_state(ConnectionStateTypes.CONNECTING)
        self.connection = DriverRemoteConnection(
            self.gremlin_url,
            traversal_source=self.traversal_source,
            graphson_reader=self.graphson_reader,
            **self.transport_kwargs
        )
        self.g = traversal().withRemote(self.connection)
        if self.strategies.__len__() > 0:
            self.g = self.g.withStrategies(*self.strategies)
        self.update_connection_state(ConnectionStateTypes.CONNECTED)

    def reconnect(self):
        self.update_connection_state(ConnectionStateTypes.RECONNECTING)
        self.connect()

    def close_connection(self) -> None:
        self.update_connection_state(ConnectionStateTypes.DISCONNECTING)
        self.connection.client.close()
        self.update_connection_state(ConnectionStateTypes.DISCONNECTED)

    def update_connection_state(self, new_state):
        self.CONNECTION_STATE = new_state
        logger.debug(f"GraphConnector state updated to : {self.CONNECTION_STATE}")

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

    def get_query_with_strategies(self, query_string):
        if self.strategies.__len__() > 0:
            strategy_prefix = self.get_strategies_object_to_string()
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

        query_string = self.get_query_with_strategies(query)
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
            if raise_exception is True:
                raise Exception(f"Failed to execute {request} with reason: {status_code}:{gremlin_server_error}"
                                f" and error message {e.__str__()}")
        except ServerDisconnectedError as e:
            request.server_disconnected_error(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise Exception(f"Failed to execute {request} with error message {e.__str__()}")
        except RuntimeError as e:
            request.runtime_error(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise RuntimeError(f"Failed to execute {request} with error message {e.__str__()}")
        except ClientConnectorError as e:
            request.client_connection_error(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise Exception(f"Failed to execute {request} with error message {e.__str__()}")
        except Exception as e:
            request.response_received_but_failed(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise Exception(f"Failed to execute {request} with error message {e.__str__()}")

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
