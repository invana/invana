from .connector import GremlinConnector


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
                                          auth=auth,
                                          **transport_kwargs)
        self.v

    @property
    def g(self):
        return self.connector.g
