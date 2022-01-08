from gremlin_python.process.graph_traversal import GraphTraversal, GraphTraversalSource
from gremlin_python.process.traversal import P, TextP, Bytecode
from gremlin_python.process.graph_traversal import __ as AnonymousTraversal


class InvanaTraversal(GraphTraversal):
    allowed_predicates_list = ['within', 'without', 'inside', 'outside', 'between', 'eq', 'neq',
                               'lt', 'lte', 'gt', 'gte', 'startingWith', 'containing', 'endingWith',
                               'notStartingWith', 'notContaining', 'notEndingWith']
    filter_key_starting_words_list = ['has']
    pagination_key_starting_words_list = ["pagination"]

    P = ["between", "eq", "gt", "gte", "inside", "lt", "lte", "neq", "not_", "outside", "within", "without"]
    PText = ["TextP"]

    @classmethod
    def separate_filters_and_pagination_kwargs(cls, **search_kwargs):
        filter_kwargs = {}
        pagination_kwargs = {}
        for kwarg_key, value in search_kwargs.items():
            for starting_keyword in cls.filter_key_starting_words_list:
                if kwarg_key.startswith(starting_keyword):
                    filter_kwargs[kwarg_key] = value
            for starting_keyword in cls.pagination_key_starting_words_list:
                if kwarg_key.startswith(starting_keyword):
                    pagination_kwargs[kwarg_key] = value
        return {"filter_kwargs": filter_kwargs, "pagination_kwargs": pagination_kwargs}

    def search(self, **kwargs):
        traversal = self.get_graph_traversal()
        if "has__label" in kwargs:
            traversal.bytecode.add_step('hasLabel', kwargs["has__label"])
        if "has__id" in kwargs:
            traversal.bytecode.add_step('hasId', kwargs["has__id"])
        cleaned_kwargs = self.separate_filters_and_pagination_kwargs(**kwargs)

        # if len(args) > 0:
        #     traversal.bytecode.add_step('has', 'name', P.within(args))
        return traversal


class __(AnonymousTraversal):
    graph_traversal = InvanaTraversal

    @classmethod
    def search(cls, **kwargs):
        return cls.graph_traversal(None, None, Bytecode()).search(**kwargs)


class InvanaTraversalSource(GraphTraversalSource):
    def __init__(self, *args, **kwargs):
        super(InvanaTraversalSource, self).__init__(*args, **kwargs)
        self.graph_traversal = InvanaTraversal
