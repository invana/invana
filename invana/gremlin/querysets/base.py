import abc
from abc import ABC
from invana.gremlin.connector import GremlinConnector
from invana.base.querysets import QuerySetBase
from ..resultsets import GremlinQueryResultSet


class GremlinQuerySetBase(QuerySetBase, abc.ABC):

    def __init__(self, connector: GremlinConnector):
        self.connector = connector

    @staticmethod
    def create_has_filters(**properties):
        search_kwargs = {}
        for k, v in properties.items():
            search_kwargs[f"has__{k}"] = v
        return search_kwargs

