#    Copyright 2021 Invana
#
#     Licensed under the Apache License, Version 2.0 (the "License");
#     you may not use this file except in compliance with the License.
#     You may obtain a copy of the License at
#
#     http:www.apache.org/licenses/LICENSE-2.0
#
#     Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#     See the License for the specific language governing permissions and
#     limitations under the License.

from invana.ogm.exceptions import FieldValidationError
from ..serializer.element_structure import Node, RelationShip


def dont_allow_has_label_kwargs(f):
    def wrapper(self, **search_kwargs):
        keys = list(search_kwargs.keys())
        for k in keys:
            if k.startswith("has__label"):
                raise FieldValidationError("has__label search kwargs not allowed when using OGM")
        return f(self, **search_kwargs)

    return wrapper


def serialize_to_model_datatypes(f):
    def wrapper(self, *args, **kwargs):
        result = f(self, *args, **kwargs)
        return _serialize_to_model_datatypes(self, result)

    return wrapper


def _serialize_to_model_datatypes(self, element):
    if isinstance(element, list):
        return [_serialize_to_model_datatypes(self, res) for res in element]
    elif element and (isinstance(element, Node) or isinstance(element, RelationShip)):
        for k, field in self.model.get_properties().items():
            if hasattr(element.properties, k):
                _ = self.get_validated_data(k, getattr(element.properties, k), self.model)
                setattr(element.properties, k, _)
        return element
    return element


def validate_kwargs_for_create(f):
    def wrapper(self, *args, **kwargs):
        validated_kwargs = _validate_kwargs_for_create(self, **kwargs)
        result = f(self, *args, **validated_kwargs)
        return _serialize_to_model_datatypes(self, result)

    return wrapper


def _validate_kwargs_for_create(self, **properties):
    """
    :param properties:
    # :param update_mode: when update_mode is True, OGM will not expect all the properties
    :return:
    """
    validated_data = {}
    allowed_property_keys = list(self.model.get_property_keys())
    for k, v in properties.items():
        if k not in allowed_property_keys:
            raise FieldValidationError(f"property '{self.model.__label__}.{k}' "
                                       f"not allowed in {self.model.__label__}."
                                       f" Hint: {allowed_property_keys} fields allowed")
    for k, field in self.model.get_properties().items():
        _ = self.get_validated_data(k, properties.get(k), self.model)
        if _ is not None:
            validated_data[k] = _
    return validated_data


def add_has_label_kwargs_from_model(f):
    def wrapper(self, **kwargs):
        kwargs['has__label'] = self.model.__label__
        return f(self, **kwargs)

    return wrapper


def validate_kwargs_for_search(f):
    def wrapper(self, **kwargs):
        validated_kwargs = _validate_kwargs_for_search(self, **kwargs)
        return f(self, **validated_kwargs)

    return wrapper


def _validate_kwargs_for_search(self, **properties):
    """
    in update_mode, OGM will not expect all the properties
    :param properties:
    :return:
    """
    validated_data = {}
    _ = self.model.get_properties()
    allowed_property_keys = list(self.model.get_property_keys())
    for k, v in properties.items():
        k_cleaned = k.replace("has__", "")
        if k_cleaned in ["label", "id"]:
            validated_data[k] = v
        elif k_cleaned not in allowed_property_keys:
            raise FieldValidationError(f"property '{k_cleaned}' not allowed in"
                                       f" {self.model.__label__} when using OGM."
                                       f" Hint: {allowed_property_keys} fields allowed")

    for k, v in properties.items():
        k_cleaned = k.replace("has__", "")
        if k_cleaned not in ["label", "id"]:
            _ = self.get_validated_data(k_cleaned, v, self.model)
            if _ is not None:
                validated_data[k] = _
    return validated_data


def validate_kwargs_for_update(f):
    def wrapper(self, **kwargs):
        validated_kwargs = _validate_kwargs_for_update(self, **kwargs)
        result = f(self, **validated_kwargs)
        return _serialize_to_model_datatypes(self, result)

    return wrapper


def _validate_kwargs_for_update(self, **properties):
    """
    in update_mode, OGM will not expect all the properties
    :param properties:
    :return:
    """
    validated_data = {}
    allowed_property_keys = list(self.model.properties.keys())
    for k, v in properties.items():
        if k not in allowed_property_keys:
            raise FieldValidationError(f"property '{self.model.__label__}.{k}' not allowed in {self.model.__label__}")
    for k, v in properties.items():
        _ = self.get_validated_data(k, v, self.model)
        if _ is not None:
            validated_data[k] = _
    return validated_data
