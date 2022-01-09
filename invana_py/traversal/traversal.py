from gremlin_python.process.graph_traversal import GraphTraversal, GraphTraversalSource
from gremlin_python.process.traversal import P, TextP, Bytecode
from gremlin_python.process.graph_traversal import __ as AnonymousTraversal
from .search import GraphSearch


class InvanaTraversal(GraphTraversal):

    def search(self, **kwargs):
        self.bytecode = GraphSearch.search(self.bytecode, **kwargs)
        return self

    def paginate(self, *args):
        self.bytecode = GraphSearch.paginate(self.bytecode, *args)
        return self


class __(AnonymousTraversal):
    graph_traversal = InvanaTraversal

    @classmethod
    def search(cls, **kwargs):
        return cls.graph_traversal(None, None, Bytecode()).search(**kwargs)

    @classmethod
    def paginate(cls, *args):
        return cls.graph_traversal(None, None, Bytecode()).paginate(*args)


class InvanaTraversalSource(GraphTraversalSource):
    def __init__(self, *args, **kwargs):
        super(InvanaTraversalSource, self).__init__(*args, **kwargs)
        self.graph_traversal = InvanaTraversal
