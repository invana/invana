from gremlin_python.process.traversal import TextP, P
from .exception import InvalidSearchKwargError


class GraphSearch:
    allowed_predicates_list = ['within', 'without', 'inside', 'outside', 'between', 'eq', 'neq',
                               'lt', 'lte', 'gt', 'gte', 'startingWith', 'containing', 'endingWith',
                               'notStartingWith', 'notContaining', 'notEndingWith']
    filter_key_starting_words_list = ['has']
    pagination_key_starting_words_list = ["pagination"]

    P = ["between", "eq", "gt", "gte", "inside", "lt", "lte", "neq", "not_", "outside", "within", "without"]
    has_filter_keys = ["has__label", "has__id", "has__value", "has__key", "has__not"]

    @classmethod
    def validate_search_kwargs(cls):
        pass

    @classmethod
    def validate_paginate_kwargs(cls):
        pass

    @staticmethod
    def split_key(_key):
        return _key.split("__")

    @classmethod
    def search(cls, bytecode, **kwargs):
        for k, v in kwargs.items():
            key_split_list = cls.split_key(k)
            if key_split_list.__len__() == 2:
                if k.startswith(tuple(cls.has_filter_keys)):
                    bytecode.add_step(f"{key_split_list[0]}{key_split_list[1].capitalize()}", v)
                else:
                    bytecode.add_step(key_split_list[0], key_split_list[1], v)
            elif key_split_list.__len__() > 2:
                if key_split_list[2] not in cls.allowed_predicates_list:
                    raise InvalidSearchKwargError(
                        f"{key_split_list[2]} not allowed in search_kwargs. "
                        f"Only {cls.allowed_predicates_list} are allowed")
                if k.startswith(tuple(cls.has_filter_keys)):
                    if hasattr(P, key_split_list[2]):
                        bytecode.add_step(f"{key_split_list[0]}{key_split_list[1].capitalize()}",
                                          getattr(P, key_split_list[2])(v))
                    elif hasattr(TextP, key_split_list[2]):
                        bytecode.add_step(f"{key_split_list[0]}{key_split_list[1].capitalize()}",
                                          getattr(TextP, key_split_list[2])(v))
                    else:
                        raise InvalidSearchKwargError(f" predicate {key_split_list[2]} not found")
                else:
                    if hasattr(P, key_split_list[2]):
                        bytecode.add_step(key_split_list[0], key_split_list[1], getattr(P, key_split_list[2])(v))
                    elif hasattr(TextP, key_split_list[2]):
                        bytecode.add_step(key_split_list[0], key_split_list[1], getattr(TextP, key_split_list[2])(v))
                    else:
                        raise InvalidSearchKwargError(f" predicate {key_split_list[2]} not found")

        return bytecode

    @classmethod
    def paginate(cls, bytecode, page_size: int, page_number: int):
        bytecode.add_step("limit", page_size)
        pagination_args = [(page_size * (page_number - 1)), (page_size * page_number)]
        bytecode.add_step("range", *pagination_args)
        return bytecode
