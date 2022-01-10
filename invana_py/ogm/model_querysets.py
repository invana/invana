from .decorators import dont_allow_has_label_kwargs, serialize_to_model_datatypes, validate_kwargs_for_create, \
    validate_kwargs_for_update_or_search, add_has_label_kwargs_from_model
from .exceptions import FieldNotFoundError, ValidationError
from .querysets import VertexQuerySet, EdgeQuerySet
from ..serializer.element_structure import Node, RelationShip
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

    @abc.abstractmethod
    def count(self, **search_kwargs):
        pass

    @staticmethod
    def get_validated_data(field_name, field_value, model):
        field = model.properties.get(field_name)
        if field is None:
            raise FieldNotFoundError(f"{field_name} doesn't exist in model '{model.__name__}'")
        validated_value = field.validate(field_value, field_name=field_name, model=model)
        return validated_value


class VertexModelQuerySet(ModelQuerySetBase):
    queryset = VertexQuerySet

    @serialize_to_model_datatypes
    @validate_kwargs_for_update_or_search
    def get_or_create(self, **properties):
        return self.queryset.get_or_create(self.model.label_name, **properties)

    @serialize_to_model_datatypes
    @validate_kwargs_for_create
    def create(self, **properties):
        _ = self.queryset.create(self.model.label_name, **properties).value_list()
        return _[0] if _.__len__() > 0 else None

    @dont_allow_has_label_kwargs
    @validate_kwargs_for_update_or_search
    @add_has_label_kwargs_from_model
    def delete(self, **search_kwargs):
        return self.queryset.delete(**search_kwargs)

    @dont_allow_has_label_kwargs
    @validate_kwargs_for_update_or_search
    @add_has_label_kwargs_from_model
    def search(self, **search_kwargs):
        return self.queryset.search(**search_kwargs)

    @dont_allow_has_label_kwargs
    @validate_kwargs_for_update_or_search
    @add_has_label_kwargs_from_model
    def count(self, **search_kwargs):
        return self.search(**search_kwargs).count()


class EdgeModelQuerySet(ModelQuerySetBase):
    queryset = EdgeQuerySet

    @serialize_to_model_datatypes
    @validate_kwargs_for_update_or_search
    def get_or_create(self, from_, to_, **properties):
        return self.queryset.get_or_create(self.model.label_name, from_, to_, **properties)

    @serialize_to_model_datatypes
    @validate_kwargs_for_create
    def create(self, from_, to_, **properties):
        _ = self.queryset.create(self.model.label_name, from_, to_, **properties).value_list()
        return _[0] if _.__len__() > 0 else None

    @dont_allow_has_label_kwargs
    @validate_kwargs_for_update_or_search
    @add_has_label_kwargs_from_model
    def delete(self, **search_kwargs):
        return self.queryset.delete(**search_kwargs)

    @dont_allow_has_label_kwargs
    @validate_kwargs_for_update_or_search
    @add_has_label_kwargs_from_model
    def search(self, **search_kwargs):
        return self.queryset.search(**search_kwargs)

    @dont_allow_has_label_kwargs
    @validate_kwargs_for_update_or_search
    @add_has_label_kwargs_from_model
    def count(self, **search_kwargs):
        return self.search(**search_kwargs).count()
