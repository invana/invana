import copy
from ..gremlin.resultsets import GremlinQueryResultSet
from ..base.resultsets import QueryResultSetBase
from ..ogm.utils import copy_traversal


class QuerySetPaginatorBase:

    def __init__(self, queryset_result: GremlinQueryResultSet, page_size: int):
        self.queryset_result = queryset_result
        self.bytecode = copy.deepcopy(queryset_result.get_traversal().bytecode)
        self.page_size = page_size