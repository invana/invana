from .decorators import dont_allow_has_label_kwargs, serialize_to_datatypes, serialize_data
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

    def validate_for_create(self, **properties):
        """
        :param properties:
        # :param update_mode: when update_mode is True, OGM will not expect all the properties
        :return:
        """
        validated_data = {}
        allowed_property_keys = list(self.model.properties.keys())
        for k, v in properties.items():
            if k not in allowed_property_keys:
                raise ValidationError(f"property '{k}' not allowed in {self.model.label_name}")
        for k, field in self.model.properties.items():
            _ = self.get_validated_data(k, properties.get(k), self.model)
            if _ is not None:
                validated_data[k] = _
        return validated_data

    def validate_for_update(self, **properties):
        """
        in update_mode, OGM will not expect all the properties
        :param properties:
        :return:
        """
        validated_data = {}
        allowed_property_keys = list(self.model.properties.keys())
        for k, v in properties.items():
            if k not in allowed_property_keys:
                raise ValidationError(f"property '{k}' not allowed in {self.model.label_name}")
        for k, v in properties.items():
            _ = self.get_validated_data(k, v, self.model)
            if _ is not None:
                validated_data[k] = _
        return validated_data


class VertexModelQuerySet(ModelQuerySetBase):
    queryset = VertexQuerySet

    def get_or_create(self, **properties):
        return self.queryset.get_or_create(self.model.label_name, **properties)

    @serialize_data
    def create(self, **properties):
        validated_data = self.validate_for_create(**properties)
        _ = self.queryset.create(self.model.label_name, **validated_data).element_map()
        return _[0] if _.__len__() > 0 else None

    def delete(self, **search_kwargs):
        dont_allow_has_label_kwargs(**search_kwargs)
        return self.queryset.delete(has__label=self.model.label_name, **search_kwargs)

    def search(self, **search_kwargs):
        dont_allow_has_label_kwargs(**search_kwargs)
        return self.queryset.search(has__label=self.model.label_name, **search_kwargs)

    def count(self, **search_kwargs):
        return self.search(**search_kwargs).count()


class EdgeModelQuerySet(ModelQuerySetBase):
    queryset = EdgeQuerySet

    def get_or_create(self, from_, to_, **properties):
        return self.queryset.get_or_create(self.model.label_name, from_, to_, **properties)

    @serialize_data
    def create(self, from_, to_, **properties):
        validated_data = self.validate_for_create(**properties)
        _ = self.queryset.create(self.model.label_name, from_, to_, **validated_data).element_map()
        return _[0] if _.__len__() > 0 else None

    def delete(self, **search_kwargs):
        dont_allow_has_label_kwargs(**search_kwargs)
        return self.queryset.delete(has__label=self.model.label_name, **search_kwargs)

    def search(self, **search_kwargs):
        dont_allow_has_label_kwargs(**search_kwargs)
        return self.queryset.search(has__label=self.model.label_name, **search_kwargs)

    def count(self, **search_kwargs):
        return self.search(**search_kwargs).count()
