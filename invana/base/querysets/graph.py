from __future__ import annotations
import abc
from typing import TYPE_CHECKING
from .base import QuerySetBase
if TYPE_CHECKING:
    from ..resultsets import QueryResultSetBase


 

class CRUDQuerySetBase(QuerySetBase):

    @abc.abstractmethod
    def create(self, *args, **kwargs):
        pass

    @abc.abstractmethod
    def search(self, **kwargs) -> QueryResultSetBase:
        pass

    # @abc.abstractmethod
    # def update(self, **properties) -> list:
    #     # TODO - validate in 
    #     pass

    @abc.abstractmethod
    def delete(self, **kwargs):
        pass

    @abc.abstractmethod
    def get_or_create(self, *args, **kwargs):
        pass

    @abc.abstractmethod
    def get_or_none(self, *args, **kwargs):
        pass
 
    @abc.abstractmethod
    def create_has_filters(self, **kwargs):
        pass
 
    @abc.abstractmethod
    def bulk_write(self, *args, **kwargs):
        pass


class VertexCRUDQuerySetBase(CRUDQuerySetBase, abc.ABC):

    @abc.abstractmethod
    def create(self, label, **properties) -> QueryResultSetBase:
        pass

    @abc.abstractmethod
    def search(self, **search_kwarg) -> QueryResultSetBase:
        pass

    @abc.abstractmethod
    def delete(self, **search_kwarg):
        pass

    @abc.abstractmethod
    def get_or_create(self, label, **properties):
        pass


 
class EdgeCRUDQuerySetBase(CRUDQuerySetBase, abc.ABC):

    @abc.abstractmethod
    def create(self, label, from_, to_, **properties) -> QueryResultSetBase:
        pass

    @abc.abstractmethod
    def search(self, **search_kwarg) -> QueryResultSetBase:
        pass

    @abc.abstractmethod
    def delete(self, **search_kwarg):
        pass

    @abc.abstractmethod
    def get_or_create(self, label, from_, to_, **properties):
        pass
