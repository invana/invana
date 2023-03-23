import abc


class QuerySetBase(abc.ABC):

    def __init__(self, connector):
        self.connector = connector


class ReturnableQuerySetBase(QuerySetBase):
    """ This will return queryset which can be extended"""

    pass
    # @abc.abstractmethod
    # def filter(self, **search_kwarg):
    #     raise NotImplementedError()

    # @abc.abstractmethod
    # def exclude(self, **search_kwarg):
    #     raise NotImplementedError()
    
    # @abc.abstractmethod
    # def order_by(self, *orderby_properties):
    #     raise NotImplementedError()

    # @abc.abstractmethod
    # def reverse(self):
    #     raise NotImplementedError()
    
    # @abc.abstractmethod
    # def distinct(self):
    #     raise NotImplementedError()
    

class NonReturnableQuerySetBase(QuerySetBase):
    """ This will not return queryset. This will be the terminating query"""

    # @abc.abstractmethod
    # def all(self):
    #     raise NotImplementedError()
    
    @abc.abstractmethod
    def create(self, *args, **kwargs):
        raise NotImplementedError()

    # @abc.abstractmethod
    # def get_or_create(self, *args, **kwargs):
    #     raise NotImplementedError()

    # @abc.abstractmethod
    # def get_or_none(self, *args, **search_kwarg):
    #     raise NotImplementedError()

    # @abc.abstractmethod
    # def get(self, **search_kwarg):
    #     raise NotImplementedError()

    # @abc.abstractmethod
    # def bulk_create(self, *args, **kwargs):
    #     raise NotImplementedError()

    # @abc.abstractmethod
    # def bulk_update(self, *args, **kwargs):
    #     raise NotImplementedError()
    
    # @abc.abstractmethod
    # def count(self):
    #     raise NotImplementedError()
    
    # @abc.abstractmethod
    # def update(self, **properties):
    #     raise NotImplementedError()
    
    # @abc.abstractmethod
    # def latest(self, *args):
    #     raise NotImplementedError()

    # @abc.abstractmethod
    # def delete(self):
    #     raise NotImplementedError()
    
    # @abc.abstractmethod
    # def get_by_id(self, _id):
    #     raise NotImplementedError()

    # @abc.abstractmethod
    # def update_or_create(self, defaults=None, **search_kwargs,):
    #     raise NotImplementedError()
