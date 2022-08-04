#    Copyright 2021 Invana
#
#     Licensed under the Apache License, Version 2.0 (the "License");
#     you may not use this file except in compliance with the License.
#     You may obtain a copy of the License at
#
#     http:www.apache.org/licenses/LICENSE-2.0
#
#     Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#     See the License for the specific language governing permissions and
#     limitations under the License.

import copy
from invana.connector.querysets import QuerySetResultSet
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
