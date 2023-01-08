# from ..connector import GraphConnectorBase
from .base import QuerySetBase
from .schema import SchemaReaderQuerySetBase, SchemaWriterQuerySetBase
from .indexes import IndexQuerySetBase


class GraphManagementQuerySetBase(QuerySetBase):
    indexes: IndexQuerySetBase = None
    schema_write : SchemaWriterQuerySetBase = None
    schema_reader: SchemaReaderQuerySetBase = None
    extras: QuerySetBase = None

    indexes_cls: IndexQuerySetBase = NotImplemented
    schema_write_cls: SchemaWriterQuerySetBase = NotImplemented
    schema_reader_cls: SchemaReaderQuerySetBase = NotImplemented
    extras_cls: QuerySetBase = None

    def __init__(self, connector):
        self.connector = connector
        self.indexes = self.indexes_cls(connector)
        self.schema_writer = self.schema_write_cls(connector)
        self.schema_reader = self.schema_reader_cls(connector)
        self.extras = self.extras_cls(connector) if self.extras_cls else None
