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
from invana.backends.janusgraph.management import GraphBackendManagement
from .connector import GremlinConnector
from .ogm.querysets import VertexQuerySet, EdgeQuerySet


class InvanaGraph:

    def __init__(self, gremlin_url: str,
                 traversal_source: str = 'g',
                 strategies=None,
                 read_only_mode: bool = False,
                 timeout: int = None,
                 graph_traversal_source_cls=None,
                 call_from_event_loop=True,
                 deserializer_map=None,
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
        self.vertex = VertexQuerySet(self.connector)
        self.edge = EdgeQuerySet(self.connector)
        self.management = GraphBackendManagement(self.connector)

    @property
    def g(self):
        return self.connector.g

    def close_connection(self):
        return self.connector.close()

    def reconnect(self):
        return self.connector.reconnect()

    def get_features(self):
        response = self.connector.execute_query("graph.features()")
        lines = response.data[0].lstrip("FEATURES\n").split("> ")
        data = {}
        for line in lines[1:]:
            items = line.rstrip().split("\n")
            data[items[0]] = {}
            for item in items[1:]:
                item = item.lstrip(">-- ").split(":")
                data[items[0]][item[0].strip()] = bool(item[1])
        response.data = data
        return response

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
