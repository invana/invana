from invana.base.querysets import GraphManagementQuerySetBase
from .schema import GremlinSchemaReaderQuerySet, GremlinSchemaWriterQuerySet
from .indexes import GremlinIndexCRUDQuerySet


class GremlinGraphManagementQuerySet(GraphManagementQuerySetBase):
    index_creator_cls = GremlinIndexCRUDQuerySet
    schema_reader_cls = GremlinSchemaReaderQuerySet
    schema_write_cls = GremlinSchemaWriterQuerySet
    