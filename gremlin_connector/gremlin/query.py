#   Copyright 2021 Invana
#  #
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#  #
#    http:www.apache.org/licenses/LICENSE-2.0
#  #
#    Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
#
from gremlin_python.process.graph_traversal import GraphTraversal, GraphTraversalSource
from gremlin_python.process.traversal import P, TextP


class QueryKwargs2GremlinQuery:
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

    @classmethod
    def process_query_kwargs(cls, element_type=None, g=None, **query_kwargs) -> GraphTraversal:
        # if element_type not in ["V", "E"]:
        #     raise Exception("invalid element_type provided, valid values are : 'V', 'E'", )
        if element_type in ["V", "E"] and isinstance(g, GraphTraversalSource):
            _ = g.V() if element_type == "V" else g.E()
            if element_type == "E" and "has__id" in query_kwargs:
                """
                Note: overriding g.E()
                This will fix the g.E().hasId("xyz") or g.E().has(id, "xyz") not working  issue 
                """
                _ = g.E(query_kwargs['has__id'])
                del query_kwargs['has__id']
        else:
            _ = g
        cleaned_kwargs = cls.separate_filters_and_pagination_kwargs(**query_kwargs)
        for kwarg_key, value in cleaned_kwargs['filter_kwargs'].items():
            kwargs__list = kwarg_key.split("__")
            if kwargs__list.__len__() >= 2:
                if kwargs__list.__len__() == 2:
                    if kwargs__list == ["has", "label"] or kwargs__list == ["has", "id"] or \
                            kwargs__list == ["has", "value"]:
                        getattr(_, f"{kwargs__list[0]}{kwargs__list[1].capitalize()}")(value)
                    else:
                        getattr(_, kwargs__list[0])(kwargs__list[1], value)
                else:
                    if kwargs__list[2] not in cls.allowed_predicates_list:
                        raise Exception("{} not allowed in search_kwargs. Only {} are allowed".format(
                            kwargs__list[2], cls.allowed_predicates_list))
                    if kwargs__list[0:2] == ["has", "label"] or kwargs__list[0:2] == ["has", "id"] or \
                            kwargs__list == ["has", "value"]:

                        if hasattr(P, kwargs__list[2]):
                            getattr(_, f"{kwargs__list[0]}{kwargs__list[1].capitalize()}")(
                                getattr(P, kwargs__list[2])(value))
                        elif hasattr(TextP, kwargs__list[2]):
                            getattr(_, f"{kwargs__list[0]}{kwargs__list[1].capitalize()}")(
                                getattr(TextP, kwargs__list[2])(value))
                        else:
                            raise ValueError(f" predicate {kwargs__list[2]} not found")
                    else:
                        if hasattr(P, kwargs__list[2]):
                            getattr(_, kwargs__list[0])(kwargs__list[1], getattr(P, kwargs__list[2])(value))
                        elif hasattr(TextP, kwargs__list[2]):
                            getattr(_, kwargs__list[0])(kwargs__list[1], getattr(TextP, kwargs__list[2])(value))
                        else:
                            raise ValueError(f" predicate {kwargs__list[2]} not found")

        for kwarg_key, value in cleaned_kwargs['pagination_kwargs'].items():
            kwargs__list = kwarg_key.split("__")
            if kwargs__list.__len__() == 2:
                if type(value) in [list, tuple]:
                    # query_string += ".{0}{1}".format(kwargs__list[1], tuple(value))
                    getattr(_, kwargs__list[1])(tuple(value))
                else:
                    getattr(_, kwargs__list[1])(value)
                    # query_string += ".{0}({1})".format(kwargs__list[1], value)
            else:
                raise Exception("{} not allowed in search_kwargs. Only {} are allowed".format(
                    kwargs__list[2], cls.allowed_predicates_list))
        return _
