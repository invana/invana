import abc 
from .base import QuerySetBase


class IndexQuerySetBase(QuerySetBase):

    @abc.abstractmethod
    def create(self, model, *args, **kwargs):
        pass

    @abc.abstractmethod
    def reindex(self, index_name, *args, **kwargs):
        pass

    @abc.abstractmethod
    def remove(self, index_name, *args, **kwargs):
        pass

    @abc.abstractmethod
    def update(self, index_name, *args, **kwargs):
        pass

    @abc.abstractmethod
    def read(self, index_name, *args, **kwargs):
        pass

    @abc.abstractmethod
    def read_all(self, *args, **kwargs):
        pass

    @abc.abstractmethod
    def check_status(self, index_name, *args, **kwargs):
        pass

