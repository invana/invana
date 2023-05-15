from .querysets.indexes import JanusGraphIndexCRUDQuerySet
from .querysets.schema import JanusGraphSchemaReaderQuerySet, JanusGraphSchemaWriterQuerySet
from invana.gremlin.querysets.management import GremlinGraphManagementQuerySet
from .querysets.extras import JanusGraphExtrasQuerySet

class JanusGraphGraphManagement(GremlinGraphManagementQuerySet):
    indexes_cls = JanusGraphIndexCRUDQuerySet
    schema_reader_cls = JanusGraphSchemaReaderQuerySet
    schema_write_cls = JanusGraphSchemaWriterQuerySet
    extras_cls = JanusGraphExtrasQuerySet
    