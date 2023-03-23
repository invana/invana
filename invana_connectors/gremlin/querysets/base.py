from invana_connectors.querysets import ReturnableQuerySetBase, NonReturnableQuerySetBase

 
class GremlinReturnableQuerySetBase(ReturnableQuerySetBase):
    """ This will return queryset which can be extended"""
    pass
    # def filter(self, **search_kwarg):
    #     raise NotImplementedError()

    # def exclude(self, **search_kwarg):
    #     raise NotImplementedError()

    # def order_by(self, *orderby_properties):
    #     raise NotImplementedError()

    # def reverse(self):
    #     raise NotImplementedError()

    # def distinct(self):
    #     raise NotImplementedError()


class GremlinNonReturnableQuerySetBase(NonReturnableQuerySetBase):
    """ This will not return queryset. This will be the terminating query"""
    pass
    # def all(self):
    #     raise NotImplementedError()

    # def create(self, *args, **kwargs):
    #     raise NotImplementedError()

    # def get_or_create(self, *args, **kwargs):
    #     raise NotImplementedError()

    # def get_or_none(self, *args, **search_kwarg):
    #     raise NotImplementedError()

    # def get(self, **search_kwarg):
    #     raise NotImplementedError()

    # def bulk_create(self, *args, **kwargs):
    #     raise NotImplementedError()

    # def bulk_update(self, *args, **kwargs):
    #     raise NotImplementedError()

    # def count(self):
    #     raise NotImplementedError()

    # def update(self, **properties):
    #     raise NotImplementedError()

    # def latest(self, *args):
    #     raise NotImplementedError()

    # def delete(self):
    #     raise NotImplementedError()

    # def get_by_id(self, _id):
    #     raise NotImplementedError()

    #
    # def update_or_create(self, defaults=None, **search_kwargs,):
    #     raise NotImplementedError()
