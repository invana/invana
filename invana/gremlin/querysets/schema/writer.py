from invana.base.querysets  import SchemaWriterQuerySetBase
from invana.ogm.models import VertexModel, EdgeModel
import logging

logger = logging.getLogger(__name__)


class GremlinSchemaWriterQuerySet(SchemaWriterQuerySetBase):

    @staticmethod
    def create(model: [VertexModel, EdgeModel]):
        raise NotImplementedError("Not sure if gremlin has way to write schema ")