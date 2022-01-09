import abc

from invana_py.connector import GremlinConnector


class SchemaReaderBase(abc.ABC):

    def __init__(self, connector: GremlinConnector):
        self.connector = connector

    @abc.abstractmethod
    def get_graph_schema(self):
        pass

    @abc.abstractmethod
    def get_vertex_schema(self, label):
        pass

    @abc.abstractmethod
    def get_edge_schema(self, label):
        pass

    @abc.abstractmethod
    def get_all_vertices_schema(self):
        pass

    @abc.abstractmethod
    def get_all_edges_schema(self):
        pass

    @abc.abstractmethod
    def get_vertex_property_keys(self, label):
        pass

    @abc.abstractmethod
    def get_edge_property_keys(self, label):
        pass


class GraphBackendBase:
    schema_reader_cls: SchemaReaderBase = None

    def __init__(self, connector: GremlinConnector):
        self.schema_reader = self.schema_reader_cls(connector)
