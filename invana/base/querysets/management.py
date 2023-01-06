from ..connector import GraphConnectorBase
from .base import QuerySetBase
from . import SchemaWriterBase, SchemaReaderBase, IndexQuerySetBase


class GraphManagementQuerySetBase(QuerySetBase):
 
    index_creator_cls: IndexQuerySetBase = NotImplemented
    schema_write_cls: SchemaWriterBase = NotImplemented
    schema_reader_cls: SchemaReaderBase = NotImplemented
    extras_cls: QuerySetBase = None

    def __init__(self, connector: GraphConnectorBase):
        self.connector = connector
        self.index_creator = self.index_creator_cls(connector)
        self.schema_writer = self.schema_write_cls(connector)
        self.schema_reader = self.schema_reader_cls(connector)
        self.extras = self.extras_cls(connector) if self.extras_cls else None
