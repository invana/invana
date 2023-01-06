import abc
from invana.ogm.models import VertexModel, EdgeModel
from ..connector import GraphConnectorBase


class SchemaWriterBase(abc.ABC):

    def __init__(self, connector: GraphConnectorBase):
        self.connector = connector

    @abc.abstractmethod
    def create_model(model: [VertexModel, EdgeModel]):
        pass