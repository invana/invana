from invana_py.backends.base import GraphBackendBase
from .schema import JanusGraphSchemaReader


class JanusGraphBackend(GraphBackendBase):
    schema_reader_cls = JanusGraphSchemaReader
