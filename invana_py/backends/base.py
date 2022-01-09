from invana_py.connector import GremlinConnector


class SchemaReaderBase:

    def __init__(self, connector: GremlinConnector):
        self.connector = connector


class GraphBackendBase:
    schema_reader_cls: SchemaReaderBase = None

    def __init__(self, connector: GremlinConnector):
        self.connector = connector
        self.schema_reader = self.schema_reader_cls(connector)
