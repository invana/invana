from .decorators import dont_allow_has_label_kwargs
from .querysets import VertexQuerySet, EdgeQuerySet
import abc


class ModelQuerySetBase(abc.ABC):
    queryset = None

    def __init__(self, connector, model):
        self.connector = connector
        self.model = model
        self.queryset = self.queryset(self.connector)

    @abc.abstractmethod
    def get_or_create(self, *args, **kwargs):
        pass

    @abc.abstractmethod
    def create(self, *args, **kwargs):
        pass

    @abc.abstractmethod
    def delete(self, **search_kwargs):
        pass

    @abc.abstractmethod
    def search(self, **search_kwargs):
        pass


class VertexModelQuerySet(ModelQuerySetBase):
    queryset = VertexQuerySet

    def get_or_create(self, **properties):
        return self.queryset.get_or_create(self.model.label_name, **properties)

    def create(self, **properties):
        _ = self.queryset.create(self.model.label_name, **properties).element_map()
        return _[0] if _.__len__() > 0 else None

    def delete(self, **search_kwargs):
        dont_allow_has_label_kwargs(**search_kwargs)
        return self.queryset.delete(has__label=self.model.label_name, **search_kwargs)

    def search(self, **search_kwargs):
        dont_allow_has_label_kwargs(**search_kwargs)
        return self.queryset.search(has__label=self.model.label_name, **search_kwargs)


class EdgeModelQuerySet(ModelQuerySetBase):
    queryset = EdgeQuerySet

    def get_or_create(self, from_, to_, **properties):
        return self.queryset.get_or_create(self.model.label_name, from_, to_, **properties)

    def create(self, from_, to_, **properties):
        _ = self.queryset.create(self.model.label_name, from_, to_, **properties).element_map()
        return _[0] if _.__len__() > 0 else None

    def delete(self, **search_kwargs):
        dont_allow_has_label_kwargs(**search_kwargs)
        return self.queryset.delete(has__label=self.model.label_name, **search_kwargs)

    def search(self, **search_kwargs):
        dont_allow_has_label_kwargs(**search_kwargs)
        return self.queryset.search(has__label=self.model.label_name, **search_kwargs)
