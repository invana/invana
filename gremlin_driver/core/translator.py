#  Copyright 2020 Invana
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#    http:www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
from gremlin_driver.core.exceptions import InvalidQueryArguments


class GremlinQueryTranslator:
    allowed_predicates_list = ['within', 'without', 'inside', 'outside', 'between', 'eq', 'neq',
                               'lt', 'lte', 'gt', 'gte', 'startingWith', 'containing', 'endingWith',
                               'notStartingWith', 'notContaining', 'notEndingWith']
    filter_key_starting_words_list = ['has']
    pagination_key_starting_words_list = ["pagination"]
    special_properties = ["id", "label"]

    edge_relation_types = ["outE" , "inE", "bothE"]

    """
    USAGE: example usage.

    gremlin_query = GremlinQueryTranslator()
    c = query_translator.process_search_kwargs(
            has__label__within=["Person", "Planet"],
            pagination__range=[0, 10],
        ) # g.V().has(label, neq('Person')).range(0, 5)

    
    
    has__id=1021
    has__id__within=[200752, 82032, 4320],
    has__label__within=["Person", "Planet"]
    has__label__without=["Person", "Planet"]
    has__label="Person"
    has__age__lte=25
    has__age__lt=25
    has__age__gte=25
    has__age__gt=25
    has__age__inside=(10, 20)
    has__age__outside=(10, 20)
    has__age__between=(10, 20)
    has__label__eq="Person"
    has__label__neq="Person"

    has__name__startingWith="Per"
    has__name__endingWith="son"
    has__name__containing="erson"
    has__name__notStartingWith="son"
    has__name__notEndingWith="son"
    has__name__notContaining="son"

    pagination__limit=10
    pagination__range=[0, 10]

    Refer https://tinkerpop.apache.org/docs/3.5.0/reference/#a-note-on-predicates for more details on usage.
    """

    @staticmethod
    def validate_search_kwargs(**search_kwargs):
        pass  # TODO - security | add this, or sometimes, it might delete entire graph data if no has__ data is sent
        valid_search_kwargs = False
        for k, v in search_kwargs.items():
            if k.startswith("has__") or k.startswith("pagination__"):
                valid_search_kwargs = True
                break
        if valid_search_kwargs is False:
            raise InvalidQueryArguments(
                "Either has__** or pagination__** search kwargs should be used with filter many type queries")

    def separate_filters_and_pagination_kwargs(self, **search_kwargs):
        filter_kwargs = {}
        pagination_kwargs = {}
        for kwarg_key, value in search_kwargs.items():
            for starting_keyword in self.filter_key_starting_words_list:
                if kwarg_key.startswith(starting_keyword):
                    filter_kwargs[kwarg_key] = value
            for starting_keyword in self.pagination_key_starting_words_list:
                if kwarg_key.startswith(starting_keyword):
                    pagination_kwargs[kwarg_key] = value
        return {"filter_kwargs": filter_kwargs, "pagination_kwargs": pagination_kwargs}

    def check_if_property_or_special_props(self, s):
        if s in self.special_properties:
            return s
        return '"{}"'.format(s)

    def process_search_kwargs(self, element_type=None, **search_kwargs):
        if element_type not in ["V", "E"]:
            raise Exception("invalid element_type provided, valid values are : 'V', 'E'", )

        query_string = "g.{element_type}()".format(element_type=element_type)

        if element_type == "E" and "has__id" in search_kwargs:
            """
            This will fix the g.E().hasId("xyz") or g.E().has(id, "xyz") not working  issue 
            """
            query_string = "g.E({})".format(self.check_if_str(search_kwargs['has__id']))
            del search_kwargs['has__id']

        cleaned_kwargs = self.separate_filters_and_pagination_kwargs(**search_kwargs)
        for kwarg_key, value in cleaned_kwargs['filter_kwargs'].items():
            kwargs__list = kwarg_key.split("__")
            if kwargs__list.__len__() >= 2:
                if kwargs__list.__len__() == 2:
                    query_string += ".{0}({1}, {2})".format(kwargs__list[0],
                                                            self.check_if_property_or_special_props(kwargs__list[1]),
                                                            self.check_if_str(value))
                else:
                    if kwargs__list[2] not in self.allowed_predicates_list:
                        raise Exception("{} not allowed in search_kwargs. Only {} are allowed".format(
                            kwargs__list[2], self.allowed_predicates_list))
                    query_string += ".{0}({1}, {2}({3}))".format(kwargs__list[0],
                                                                 self.check_if_property_or_special_props(
                                                                     kwargs__list[1]),
                                                                 kwargs__list[2],
                                                                 self.check_if_str(value))
        for kwarg_key, value in cleaned_kwargs['pagination_kwargs'].items():
            kwargs__list = kwarg_key.split("__")
            if kwargs__list.__len__() == 2:
                if type(value) in [list, tuple]:
                    query_string += ".{0}{1}".format(kwargs__list[1], tuple(value))
                else:
                    query_string += ".{0}({1})".format(kwargs__list[1], value)
            else:
                raise Exception("{} not allowed in search_kwargs. Only {} are allowed".format(
                    kwargs__list[2], self.allowed_predicates_list))
        return query_string

    def generate_gremlin_query_for_properties(self, **property_kwargs):
        """

        :param property_kwargs: key, value pairs for properties
        :return:
        """
        query_string = ""
        for k, v in property_kwargs.items():
            query_string += ".property({k},{v})".format(k=self.check_if_str(k), v=self.check_if_str(v))
        return query_string

    @staticmethod
    def convert_properties_to_query(**properties):
        """
        :param properties: key, value pairs of properties
        :return:
        """
        query_kwargs = {}
        for k, v in properties.items():
            query_kwargs["has__{0}".format(k)] = v
        return query_kwargs

    @staticmethod
    def check_if_str(s):
        if type(s) is str:
            return '"{}"'.format(s)
        return s

    def generate_edge_filters(self, starting_vertex_filters=None, edge_relation_type=None,
                              edge_filters=None):
        if edge_relation_type not in self.edge_relation_types:
            raise Exception("edge_type should of {}".format(self.edge_relation_types))
        query_string = self.process_search_kwargs(
            element_type="V", **starting_vertex_filters or {})
        query_string += ".{edge_relation_type}()".format(edge_relation_type=edge_relation_type)
        query_string += self.process_search_kwargs(
            element_type="E", **edge_filters or {}).replace("g.E()", "")
        return query_string
        # query_string += ".elementMap().dedup().toList();"
