from abc import ABC
from gremlin_python.process.traversal import Cardinality

from .base import QuerySetBase


class VertexQuerySet(QuerySetBase, ABC):

    def create(self, label, properties=None, traversal=None):
        g = traversal if traversal else self.connector.g
        _ = g.addV(label)
        for k, v in properties.items():
            _.property(Cardinality.single, k, v)
        return _.next()
