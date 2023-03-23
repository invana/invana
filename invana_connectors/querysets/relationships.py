import abc
from .base import ReturnableQuerySetBase, NonReturnableQuerySetBase
    

class RelationShipReturnableQuerySetBase(ReturnableQuerySetBase):
    """
    These are the methods that returns querysets
    """
    pass
                 

class RelationShipNonReturnableQuerySetBase(NonReturnableQuerySetBase):
 
    @abc.abstractmethod
    def create(self, label, from_, to_, **properties):
        raise NotImplementedError()

#     @abc.abstractmethod
#     def get_or_create(self, label, from_, to_, **properties):
#         pass

#     @abc.abstractmethod
#     def get_or_none(self, label, from_, to_, **properties):
#         pass


class RelationShipQuerySetBase(RelationShipNonReturnableQuerySetBase,
                        RelationShipReturnableQuerySetBase):
    pass