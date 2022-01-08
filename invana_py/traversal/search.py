class GraphSearch:
    allowed_predicates_list = ['within', 'without', 'inside', 'outside', 'between', 'eq', 'neq',
                               'lt', 'lte', 'gt', 'gte', 'startingWith', 'containing', 'endingWith',
                               'notStartingWith', 'notContaining', 'notEndingWith']
    filter_key_starting_words_list = ['has']
    pagination_key_starting_words_list = ["pagination"]

    P = ["between", "eq", "gt", "gte", "inside", "lt", "lte", "neq", "not_", "outside", "within", "without"]
    PText = ["TextP"]

    def validate_search_kwargs(self):
        pass

    def validate_paginate_kwargs(self):
        pass


    # @classmethod
    # def separate_filters_and_pagination_kwargs(cls, **search_kwargs):
    #     filter_kwargs = {}
    #     pagination_kwargs = {}
    #     for kwarg_key, value in search_kwargs.items():
    #         for starting_keyword in cls.filter_key_starting_words_list:
    #             if kwarg_key.startswith(starting_keyword):
    #                 filter_kwargs[kwarg_key] = value
    #         for starting_keyword in cls.pagination_key_starting_words_list:
    #             if kwarg_key.startswith(starting_keyword):
    #                 pagination_kwargs[kwarg_key] = value
    #     return {"filter_kwargs": filter_kwargs, "pagination_kwargs": pagination_kwargs}
