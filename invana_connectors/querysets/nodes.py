import abc
from .base import ReturnableQuerySetBase, NonReturnableQuerySetBase
    

class NodeReturnableQuerySetBase(ReturnableQuerySetBase):
    """
    These are the methods that returns querysets
    """
    pass

  
class NodeNonReturnableQuerySetBase(NonReturnableQuerySetBase):

    @abc.abstractmethod
    def create(self, label, **properties):
        raise NotImplementedError()

    @abc.abstractmethod
    def get_or_create(self, label, **properties):
        raise NotImplementedError()

    @abc.abstractmethod
    def get_or_none(self, label, **properties):
        raise NotImplementedError()



class NodeQuerySetBase(NodeNonReturnableQuerySetBase, 
                   NodeReturnableQuerySetBase):
    pass