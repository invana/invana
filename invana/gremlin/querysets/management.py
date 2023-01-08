from invana.base.querysets.management import GraphManagementQuerySetBase
from .schema import GremlinSchemaReaderQuerySet, GremlinSchemaWriterQuerySet
from .indexes import GremlinIndexCRUDQuerySet


class GremlinGraphManagementQuerySet(GraphManagementQuerySetBase):
    indexes_cls = GremlinIndexCRUDQuerySet
    schema_reader_cls = GremlinSchemaReaderQuerySet
    schema_write_cls = GremlinSchemaWriterQuerySet
    