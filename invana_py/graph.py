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

from .connector import GremlinConnector
from .ogm.querysets import VertexQuerySet, EdgeQuerySet
from .backends.janusgraph import JanusGraphBackend, JanusGraphSchemaReader
from .backends.base import GraphBackendBase


class InvanaGraph:

    def __init__(self, gremlin_url: str,
                 traversal_source: str = 'g',
                 strategies=None,
                 read_only_mode: bool = False,
                 timeout: int = None,
                 graph_traversal_source_cls=None,
                 call_from_event_loop=True,
                 deserializer_map=None,
                 graph_backend_cls: GraphBackendBase = None,
                 auth=None,
                 **transport_kwargs):
        self.connector = GremlinConnector(gremlin_url,
                                          traversal_source=traversal_source,
                                          strategies=strategies,
                                          read_only_mode=read_only_mode,
                                          timeout=timeout,
                                          graph_traversal_source_cls=graph_traversal_source_cls,
                                          call_from_event_loop=call_from_event_loop,
                                          deserializer_map=deserializer_map,
                                          **transport_kwargs)
        graph_backend_cls = JanusGraphBackend if graph_backend_cls is None else graph_backend_cls
        self.backend = graph_backend_cls(self.connector)
        self.vertex = VertexQuerySet(self.connector)
        self.edge = EdgeQuerySet(self.connector)

    @property
    def g(self):
        return self.connector.g

    def close_connection(self):
        return self.connector.close()

    def reconnect(self):
        return self.connector.reconnect()

    def execute_query(self, query: str, timeout: int = None, raise_exception: bool = False,
                      finished_callback=None) -> any:
        """

        :param query:
        :param timeout:
        :param raise_exception: When set to False, no exception will be raised.
        :param finished_callback:
        :return:
        """
        return self.connector.execute_query(query, timeout=timeout, raise_exception=raise_exception,
                                            finished_callback=finished_callback)

    def execute_query_with_callback(self, query: str, callback, timeout=None, raise_exception: bool = False,
                                    finished_callback=None) -> None:
        self.connector.execute_query_with_callback(query, callback=callback, timeout=timeout,
                                                   raise_exception=raise_exception, finished_callback=finished_callback)
