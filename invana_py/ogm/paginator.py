import copy
from .querysets import QuerySetResultSet
from .utils import copy_traversal


class QuerySetPaginator:

    def __init__(self, queryset_result: QuerySetResultSet, page_size: int):
        self.queryset_result = queryset_result
        self.bytecode = copy.deepcopy(queryset_result.get_traversal().bytecode)
        self.page_size = page_size

    def page(self, page_no) -> QuerySetResultSet:
        traversal = copy_traversal(self.queryset_result.get_traversal())
        range_set = ((page_no - 1) * self.page_size), (page_no * self.page_size)
        _ = traversal.range(*range_set)
        return QuerySetResultSet(_)
