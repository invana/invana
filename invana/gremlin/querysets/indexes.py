from invana.base.querysets.indexes import IndexQuerySetBase
from ..exceptions import CantImplementInGremlinError


class GremlinIndexCRUDQuerySet(IndexQuerySetBase):

    def create(self, model, *args, **kwargs):
        raise CantImplementInGremlinError()

    def reindex(self, index_name, *args, **kwargs):
        raise CantImplementInGremlinError()

    def remove(self, index_name, *args, **kwargs):
        raise CantImplementInGremlinError()

    def update(self, index_name, *args, **kwargs):
        raise CantImplementInGremlinError()

    def read(self, index_name, *args, **kwargs):
        raise CantImplementInGremlinError()

    def read_all(self, *args, **kwargs):
        raise CantImplementInGremlinError()
    
    def check_status(self, index_name, *args, **kwargs):
        raise CantImplementInGremlinError()

