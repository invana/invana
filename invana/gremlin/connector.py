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

from aiohttp import ServerDisconnectedError, ClientConnectorError
from gremlin_python.process.anonymous_traversal import traversal
from gremlin_python.process.strategies import ReadOnlyStrategy
from gremlin_python.driver.protocol import GremlinServerError
from gremlin_python.driver.driver_remote_connection import DriverRemoteConnection as _DriverRemoteConnection
from ..connector.request import QueryRequest
from ..base.constants import GremlinServerErrorStatusCodes, ConnectionStateTypes
from invana.traversal.traversal import InvanaTraversalSource
from ..connector.utils import read_from_result_set_with_callback, read_from_result_set_with_out_callback
from ..serializer.graphson_reader import INVANA_DESERIALIZER_MAP
from gremlin_python.structure.io.graphsonV3d0 import GraphSONReader
from invana.connector.response import Response
from invana.base.connector import GraphConnectorBase
from invana.settings import DEFAULT_TIMEOUT
import logging

logger = logging.getLogger(__name__)




class DriverRemoteConnection(_DriverRemoteConnection):

    @property
    def client(self):
        return self._client


class GremlinConnector(GraphConnectorBase):

    def __init__(self, connection_uri: str,
                 traversal_source: str = 'g',
                 strategies=None,
                 read_only_mode: bool = False,
                 timeout: int = None,
                 graph_traversal_source_cls=None,
                 call_from_event_loop=True,
                 deserializer_map=None,
                 **transport_kwargs):
        """

        :param connection_uri:
        :param traversal_source:
        :param strategies:
        :param read_only_mode:
        :param timeout: in milliseconds
        :param graph_traversal_source_cls:
        :param call_from_event_loop:
        :param deserializer_map:
        :param transport_kwargs:
        """

        self.CONNECTION_STATE = None
        self.connection = None
        self.g = None
        self.connection_uri = connection_uri
        self.traversal_source = traversal_source
        self.strategies = strategies or []
        self.graph_traversal_source_cls = InvanaTraversalSource if graph_traversal_source_cls is None \
            else graph_traversal_source_cls
        self.timeout = DEFAULT_TIMEOUT if timeout is None else timeout
        if read_only_mode:
            self.strategies.append(ReadOnlyStrategy())
        if call_from_event_loop:
            transport_kwargs['call_from_event_loop'] = call_from_event_loop
        self.transport_kwargs = transport_kwargs
        INVANA_DESERIALIZER_MAP.update(deserializer_map or {})
        self.deserializer_map = INVANA_DESERIALIZER_MAP
        self.connect()
 
    def _init_connection(self):
        self.connection = DriverRemoteConnection(
            self.connection_uri,
            traversal_source=self.traversal_source,
            graphson_reader=GraphSONReader(deserializer_map=self.deserializer_map),
            **self.transport_kwargs
        )
        self.g = traversal(traversal_source_class=self.graph_traversal_source_cls).withRemote(self.connection)
        if self.strategies.__len__() > 0:
            self.g = self.g.withStrategies(*self.strategies)

    def _close_connection(self) -> None:
        self.connection.client.close()
 
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
        timeout = self.timeout if timeout is None else timeout
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
            return Response(request.request_id, 500, exception=e)
        except ServerDisconnectedError as e:
            request.server_disconnected_error(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise Exception(f"Failed to execute {request} with error message {e.__str__()}")
            return Response(request.request_id, 500, exception=e)
        except RuntimeError as e:
            e.args = [f"Failed to execute {request} with error message {e.__str__()}"]
            request.runtime_error(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise e
            return Response(request.request_id, None, exception=e)
        except ClientConnectorError as e:
            e.args = [f"Failed to execute {request} with error message {e.__str__()}"]
            request.client_connection_error(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise e
            return Response(request.request_id, 500, exception=e)
        except Exception as e:
            e.args = [f"Failed to execute {request} with error message {e.__str__()}"]
            request.response_received_but_failed(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise e
            return Response(request.request_id, None, exception=e)

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
