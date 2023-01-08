from .querysets.indexes import GremlinIndexCRUDQuerySet
from .querysets.schema import JanusGraphSchemaReaderQuerySet, JanusGraphSchemaWriterQuerySet
from invana.gremlin.querysets.management import GremlinGraphManagementQuerySet


class JanusGraphGraphManagement(GremlinGraphManagementQuerySet):
    index_creator_cls = GremlinIndexCRUDQuerySet
    schema_reader_cls = JanusGraphSchemaReaderQuerySet
    schema_write_cls = JanusGraphSchemaWriterQuerySet
    