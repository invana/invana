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
from gremlin_python.process.graph_traversal import GraphTraversal
from gremlin_python.process.traversal import P


class QueryKwargs2GremlinQuery:
    allowed_predicates_list = ['within', 'without', 'inside', 'outside', 'between', 'eq', 'neq',
                               'lt', 'lte', 'gt', 'gte', 'startingWith', 'containing', 'endingWith',
                               'notStartingWith', 'notContaining', 'notEndingWith']
    filter_key_starting_words_list = ['has']
    pagination_key_starting_words_list = ["pagination"]
    special_properties = ["id", "label"]

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
    def check_if_property_or_special_props(cls, s):
        if s in cls.special_properties:
            return s
        return '"{}"'.format(s)

    @staticmethod
    def check_if_str(s):
        if type(s) is str:
            return '{}'.format(s)
        return s

    @classmethod
    def process_query_kwargs(cls, element_type=None, g=None, **query_kwargs) -> GraphTraversal:
        if element_type not in ["V", "E"]:
            raise Exception("invalid element_type provided, valid values are : 'V', 'E'", )
        _ = g.V() if element_type == "V" else g.E()
        if element_type == "E" and "has__id" in query_kwargs:
            """
            This will fix the g.E().hasId("xyz") or g.E().has(id, "xyz") not working  issue 
            """
            _ = g.E(query_kwargs['has__id'])
            del query_kwargs['has__id']
        cleaned_kwargs = cls.separate_filters_and_pagination_kwargs(**query_kwargs)
        for kwarg_key, value in cleaned_kwargs['filter_kwargs'].items():
            kwargs__list = kwarg_key.split("__")
            if kwargs__list.__len__() >= 2:
                if kwargs__list.__len__() == 2:
                    if kwargs__list == ["has", "label"] or kwargs__list == ["has", "id"]:
                        getattr(_, f"{kwargs__list[0]}{kwargs__list[1].capitalize()}")(cls.check_if_str(value))
                    else:
                        getattr(_, kwargs__list[0])(cls.check_if_property_or_special_props(kwargs__list[1]),
                                                    cls.check_if_str(value))
                else:
                    if kwargs__list[2] not in cls.allowed_predicates_list:
                        raise Exception("{} not allowed in search_kwargs. Only {} are allowed".format(
                            kwargs__list[2], cls.allowed_predicates_list))
                    if kwargs__list[0:2] == ["has", "label"] or kwargs__list[0:2] == ["has", "id"]:
                        getattr(_, f"{kwargs__list[0]}{kwargs__list[1].capitalize()}")(
                            getattr(P, kwargs__list[2])(cls.check_if_str(value)))
                    else:
                        getattr(_, kwargs__list[0])(
                            cls.check_if_property_or_special_props(kwargs__list[1]),
                            getattr(P, kwargs__list[2])(cls.check_if_str(value)))

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
