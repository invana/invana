from invana.base.querysets.management import GraphManagementBase
from .querysets import 
from .querysets.indexes import GremlinIndexCRUD
from invana.gremlin.querysets.management import GremlinGraphManagement


class JanusGraphGraphManagement(GremlinGraphManagement):
    index_creator_cls = GremlinIndexCRUD
    schema_reader_cls = JanusGraphSchemaReader
    schema_write_cls = JanusGraphSchemaWriter
    