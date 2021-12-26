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
import typing
from abc import ABC

from gremlin_python.statics import FloatType, LongType, SingleChar, SingleByte, ListType, SetType, ByteBufferType, \
    IntType
import abc

from gremlin_connector.orm.exceptions import ValidationError


class FieldBase:
    data_type = None

    def __init__(self, *,
                 default: typing.Any = None,
                 index: bool = False,
                 unique: bool = False,
                 allow_null: bool = False,
                 read_only: bool = False,
                 **kwargs):
        self.allow_null = allow_null
        self.index = index
        self.unique = unique
        self.default = default
        self.allow_null = allow_null
        self.read_only = read_only
        # self.validator = self.get_validator(*, **kwargs)

    def get_field_type(self):
        return self.data_type

    def validate(self, value: typing.Any, field_name=None) -> typing.Any:
        return NotImplementedError()

    def get_validator(self, **kwargs):
        raise NotImplementedError()  # pragma: no cover


class StringField(FieldBase, ABC):
    data_type = str

    def __init__(self, max_length=None, min_length=None, **kwargs):
        if max_length is None and min_length is None:
            raise ValidationError(f"Either min_length or max_length should be provided for {self.__name__}")
        # assert max_length is not None, "max_length is required"
        super().__init__(**kwargs)
        self.max_length = max_length
        self.min_length = min_length

    def validate(self, value, field_name=None):
        if self.max_length and value.__len__() > self.max_length:
            raise ValidationError(
                f"max_length for field '{field_name}' is {self.max_length} but the value has {value.__len__()}")
        if self.min_length and value.__len__() < self.min_length:
            raise ValidationError(
                f"min_length for field '{field_name}' is {self.min_length} but the value has {value.__len__()}")

        return self.data_type(value)


class BooleanField(FieldBase, ABC):
    data_type = bool


class ByteField(FieldBase):
    data_type = ByteBufferType


class ShortField(FieldBase):
    data_type = None


class IntegerField(FieldBase):
    data_type = IntType


class LongField(FieldBase):
    data_type = LongType


class FloatField(FieldBase):
    data_type = FloatType


class DoubleField(FieldBase):
    data_type = None


class GeoshapeField(FieldBase):
    data_type = None


class DateField(FieldBase):
    pass


class InstantField(FieldBase):
    pass


class UUIDField(FieldBase):
    pass
