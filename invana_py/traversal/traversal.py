from gremlin_python.process.graph_traversal import GraphTraversal, GraphTraversalSource
from gremlin_python.process.traversal import P, TextP, Bytecode
from gremlin_python.process.graph_traversal import __ as AnonymousTraversal


class InvanaTraversal(GraphTraversal):

    def search(self, **kwargs):
        if "has__label" in kwargs:
            self.bytecode.add_step('hasLabel', kwargs["has__label"])
        if "has__id" in kwargs:
            self.bytecode.add_step('hasId', kwargs["has__id"])
        cleaned_kwargs = self.separate_filters_and_pagination_kwargs(**kwargs)

        # if len(args) > 0:
        #     traversal.bytecode.add_step('has', 'name', P.within(args))
        return self


class __(AnonymousTraversal):
    graph_traversal = InvanaTraversal

    @classmethod
    def search(cls, **kwargs):
        return cls.graph_traversal(None, None, Bytecode()).search(**kwargs)


class InvanaTraversalSource(GraphTraversalSource):
    def __init__(self, *args, **kwargs):
        super(InvanaTraversalSource, self).__init__(*args, **kwargs)
        self.graph_traversal = InvanaTraversal
