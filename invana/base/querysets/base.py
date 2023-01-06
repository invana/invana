import abc
from invana.base.connector import GraphConnectorBase

class QuerySetBase(abc.ABC):

    def __init__(self, connector: GraphConnectorBase):
        self.connector = connector
