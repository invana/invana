#   Copyright 2021 Invana
#  #
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#  #
#    http:www.apache.org/licenses/LICENSE-2.0
#  #
#    Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
#
import datetime
import typing
from abc import ABC

from gremlin_python.statics import FloatType, long, SingleChar, SingleByte, ListType, SetType, ByteBufferType, \
    IntType, LongType
from invana_py.ogm.exceptions import FieldValidationError


class FieldBase:
    data_type = None

    def __init__(self, *,
                 default: typing.Any = None,
                 unique: bool = False,
                 allow_null: bool = False,
                 read_only: bool = False,
                 **kwargs):
        self.allow_null = allow_null
        self.unique = unique
        self.default = default
        self.allow_null = allow_null
        self.read_only = read_only
        # self.validator = self.get_validator(*, **kwargs)

    def get_field_type(self):
        return self.data_type

    def validate(self, value, field_name=None, model=None):
        return NotImplementedError()

    def get_validator(self, **kwargs):
        raise NotImplementedError()  # pragma: no cover


class StringProperty(FieldBase, ABC):
    data_type = str

    def __init__(self, max_length=None, min_length=None, trim_whitespaces=True, **kwargs):
        # if max_length is None and min_length is None:
        #     raise FieldValidationError(f"Either min_length or max_length should be provided for {self.__name__}")
        # assert max_length is not None, "max_length is required"
        super().__init__(**kwargs)
        self.max_length = max_length
        self.min_length = min_length
        self.trim_whitespaces = trim_whitespaces

    def validate(self, value, field_name=None, model=None):
        assert value is None or isinstance(value, str)
        assert self.max_length is None or isinstance(self.max_length, int)
        assert self.min_length is None or isinstance(self.min_length, int)
        assert self.allow_null is None or isinstance(self.allow_null, bool)
        assert self.trim_whitespaces is None or isinstance(self.trim_whitespaces, bool)
        if value is None and self.default:
            value = self.default

        if value is not None and self.trim_whitespaces is True:
            value = value.strip()

        if self.allow_null is False and value is None:
            raise FieldValidationError(
                f"field '{model.label_name}.{field_name}' cannot be null when allow_null is False")

        if value:
            if self.max_length and value.__len__() > self.max_length:
                raise FieldValidationError(
                    f"max_length for field '{model.label_name}.{field_name}' is {self.max_length} but "
                    f"the value has {value.__len__()}")
            if self.min_length and value.__len__() < self.min_length:
                raise FieldValidationError(
                    f"min_length for field '{model.label_name}.{field_name}' is {self.min_length} but "
                    f"the value has {value.__len__()}")

        return self.data_type(value) if value else value


class BooleanProperty(FieldBase, ABC):
    data_type = bool

    def validate(self, value, field_name=None, model=None):
        if value and not isinstance(value, self.data_type):
            raise FieldValidationError(
                f"field '{model.label_name}.{field_name}' cannot be '{value}'. must be a boolean")
        assert value is None or isinstance(value, self.data_type)
        if self.default:
            assert self.default is None or isinstance(self.default, bool)
        if value is None and self.default:
            value = self.default

        return self.data_type(value) if value is not None else value


class NumberFieldBase(FieldBase, ABC):
    number_data_types = [int, float, long]


    def __init__(self, min_value=None, max_value=None, **kwargs):
        super().__init__(**kwargs)
        self.min_value = min_value
        self.max_value = max_value

    def validate(self, value, field_name=None, model=None):

        # TODO - CHECK if min_value and max_value are assigned respective data types
        if value and type(value) not in self.number_data_types:
            raise FieldValidationError(f"field '{model.label_name}.{field_name}' cannot be of type {type(value)},"
                                       f" expecting {self.data_type}")

        assert self.max_value is None or isinstance(self.max_value, int)
        assert self.min_value is None or isinstance(self.min_value, int)
        assert self.allow_null is None or isinstance(self.allow_null, bool)
        if value is None and self.default:
            value = self.default
        if self.allow_null is False and value is None:
            raise FieldValidationError(
                f"field '{model.label_name}.{field_name}' cannot be null when allow_null is False")
        if value is not None:
            if self.max_value and value > self.max_value:
                raise FieldValidationError(
                    f"max_value for field '{model.label_name}.{field_name}' is {self.max_value} but the value has {value}")
            if self.min_value and value < self.min_value:
                raise FieldValidationError(
                    f"min_value for field '{model.label_name}.{field_name}' is {self.min_value} but the value has {value}")

        return self.data_type(value) if value else value


class IntegerProperty(NumberFieldBase, ABC):
    data_type = IntType


class FloatProperty(NumberFieldBase, ABC):
    data_type = FloatType


class DoubleProperty(NumberFieldBase, ABC):
    data_type = LongType


class DateTimeProperty(FieldBase, ABC):
    data_type = datetime.datetime

    def __init__(self, min_value=None, max_value=None, **kwargs):
        super().__init__(**kwargs)
        self.min_value = min_value
        self.max_value = max_value

    def validate_value_data_types(self, value, model, field_name):
        if value and not isinstance(value, self.data_type):
            raise FieldValidationError(f"field '{model.label_name}.{field_name}' cannot be of "
                                       f"type {type(value)}, expecting {self.data_type}")
        if self.max_value and not isinstance(self.max_value, self.data_type):
            raise FieldValidationError(f"field '{model.label_name}.{field_name}' cannot be of "
                                       f"type {type(self.max_value)}, expecting {self.data_type}")
        if self.min_value and not isinstance(value, self.data_type):
            raise FieldValidationError(f"field '{model.label_name}.{field_name}' cannot be of "
                                       f"type {type(self.min_value)}, expecting {self.data_type}")

        if value is not None:
            if self.max_value and value > self.max_value:
                assert self.max_value is None or isinstance(self.max_value, datetime.datetime)
                raise FieldValidationError(f"max_value for field '{model.label_name}.{field_name}' is"
                                           f" {self.max_value} but the value has {value}")
            if self.min_value and value < self.min_value:
                assert self.min_value is None or isinstance(self.min_value, datetime.datetime)
                raise FieldValidationError(f"min_value for field '{model.label_name}.{field_name}' is"
                                           f" {self.min_value} but the value has {value}")

    def validate(self, value, field_name=None, min_value=None, max_value=None, model=None):
        if value is None and self.default:
            value = self.default()
        if self.allow_null is False and value is None:
            raise FieldValidationError(
                f"field '{model.label_name}.{field_name}' cannot be null when allow_null is False")
        self.validate_value_data_types(value, model, field_name)
        return value

#
# class LongField(NumberFieldBase, ABC):
#     data_type = LongType
#
#
# class DoubleField(FieldBase):
#     data_type = None
#
# class ByteField(FieldBase, ABC):
#     data_type = ByteBufferType
#
# class InstantField(FieldBase):
#     pass
#
# class GeoshapeField(FieldBase):
#     data_type = None
#
# class UUIDField(FieldBase):
#     pass
#
# class DateFieldBase(FieldBase, ABC):
#
#
# class DateField(DateFieldBase, ABC):
#     data_type = datetime.datetime
#
