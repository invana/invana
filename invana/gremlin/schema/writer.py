from invana.base.schema.writer import SchemaWriterBase
from invana.ogm.models import VertexModel, EdgeModel
from invana.serializer.schema_structure import VertexSchema, PropertySchema, EdgeSchema, LinkPath
import logging

logger = logging.getLogger(__name__)


class GremlinSchemaWriter(SchemaWriterBase):

    @staticmethod
    def create_model(model: [VertexModel, EdgeModel]):
        raise NotImplementedError("Not sure if gremlin has way to write schema ")