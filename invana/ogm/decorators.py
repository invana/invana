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
from .utils import get_absolute_field_name

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
        for k, field in self.model.properties.items():
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
    allowed_property_keys = list(self.model.properties.keys())
    for k, v in properties.items():
        if k not in allowed_property_keys:
            raise FieldValidationError(f"property '{self.model.label_name}.{k}' "
                                       f"not allowed in {self.model.label_name}."
                                       f" Hint: {allowed_property_keys} fields allowed")
    for k, field in self.model.properties.items():
        _ = self.get_validated_data(k, properties.get(k), self.model)
        if _ is not None:
            validated_data[k] = _
    return validated_data


def add_has_label_kwargs_from_model(f):
    def wrapper(self, **kwargs):
        kwargs['has__label'] = self.model.label_name
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
    allowed_property_keys = list(self.model.properties.keys())

    # validate if the property_key is in Model.property_keys
    for k, v in properties.items():
        k_cleaned = get_absolute_field_name(k)
        # k_cleaned = k.replace("has__", "")
        # if "__" in k_cleaned: # remove the search predicate like name__startingWith
        #     k_cleaned = k_cleaned.split("__")[0]

        if k_cleaned in ["label", "id"]:
            validated_data[k] = v

        elif k_cleaned not in allowed_property_keys:
            raise FieldValidationError(f"property '{k_cleaned}' not allowed in"
                                       f" {self.model.label_name} when using OGM."
                                       f" Hint: {allowed_property_keys} fields allowed")

    # validate if the property_key value matches the Model Field type definition
    for field_name_kwarg, field_kwarg_value in properties.items():
        field_name = get_absolute_field_name(field_name_kwarg)
        if field_name not in ["label", "id"]:
            _ = None
            if type(field_kwarg_value) in (list, tuple):
                _ = []
                for v in field_kwarg_value:
                    _.append(self.get_validated_data(field_name, v, self.model))
                _ = tuple(_) if type(field_kwarg_value) is tuple else _
            else:
                _ = self.get_validated_data(field_name, field_kwarg_value, self.model)
            if _ is not None:
                validated_data[field_name_kwarg] = _
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
            raise FieldValidationError(f"property '{self.model.label_name}.{k}' not allowed in {self.model.label_name}")
    for k, v in properties.items():
        _ = self.get_validated_data(k, v, self.model)
        if _ is not None:
            validated_data[k] = _
    return validated_data
