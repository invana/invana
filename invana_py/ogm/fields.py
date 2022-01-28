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
#
import datetime
import types
import typing
from abc import ABC
from invana_py.connector.data_types import FloatType, IntegerType, DoubleType, LongType, BooleanType, \
    SingleCharType, StringType, DateTimeType, ByteType, ShortType
from gremlin_python.statics import long
from invana_py.ogm.exceptions import FieldValidationError

__all__ = ['StringProperty', 'SingleCharProperty', 'BooleanProperty', ]


class FieldBase:
    data_type = None
    allowed_data_types = []

    def __init__(self, *,
                 default: typing.Any = None,
                 # unique: bool = False,
                 allow_null: bool = False,
                 read_only: bool = False,
                 **kwargs):
        self.allow_null = allow_null
        # self.unique = unique
        self.default = default
        self.allow_null = allow_null
        self.read_only = read_only
        # self.validator = self.get_validator(*, **kwargs)
        # self.validate_value_data_types()

    def get_field_type(self):
        return self.data_type

    def get_data_type_class(self):
        return self.data_type.__name__.rstrip("Type")

    def validate(self, value, field_name=None, model=None):
        default_value = self.get_default_value()
        value = default_value if value is None and default_value else value
        if self.allow_null is False and value is None:
            raise FieldValidationError(
                f"field '{model.label_name}.{field_name}' cannot be null when allow_null is False")
        self.validate_value_data_types(value, model, field_name)
        self.validate_field_kwargs(value, model, field_name)
        return value

    def get_default_value(self, ):
        if self.default and isinstance(self.default, types.FunctionType):
            return self.default()
        return self.default

    def get_validator(self, **kwargs):
        raise NotImplementedError()  # pragma: no cover

    def validate_value_data_types(self, value, model, field_name):
        if value and type(value) not in self.allowed_data_types:
            raise FieldValidationError(f"field '{model.label_name}.{field_name}' cannot be of type {type(value)},"
                                       f" allowed_data_types: {self.allowed_data_types}")

    def validate_field_kwargs(self, value, model, field_name):
        raise NotImplementedError()

    def convert_to_data_type(self, value, model, field_name):
        try:
            return self.data_type(value) if value is not None else value
        except Exception as e:
            raise FieldValidationError(f"field '{model.label_name}.{field_name}' failed with error: {e.__str__()}")


class StringProperty(FieldBase, ABC):
    data_type = StringType
    allowed_data_types = [StringType, str]

    def __init__(self, max_length=None, min_length=None, trim_whitespaces=True, **kwargs):
        super().__init__(**kwargs)
        self.max_length = max_length
        self.min_length = min_length
        self.trim_whitespaces = trim_whitespaces

    def validate_field_kwargs(self, value, model, field_name):
        assert self.max_length is None or isinstance(self.max_length, int)
        assert self.min_length is None or isinstance(self.min_length, int)
        assert self.allow_null is None or isinstance(self.allow_null, bool)
        assert self.trim_whitespaces is None or isinstance(self.trim_whitespaces, bool)
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

    def validate(self, value, field_name=None, model=None):
        value = super(StringProperty, self).validate(value, field_name=field_name, model=model)
        if value is not None and self.trim_whitespaces is True:
            value = value.strip()
        return self.convert_to_data_type(value, model, field_name)


class SingleCharProperty(FieldBase, ABC):
    data_type = SingleCharType
    allowed_data_types = [SingleCharType, str]

    def validate_field_kwargs(self, value, model, field_name):
        pass

    def validate(self, value, field_name=None, model=None):
        value = super(SingleCharProperty, self).validate(value, field_name=field_name, model=model)
        return self.convert_to_data_type(value, model, field_name)


class BooleanProperty(FieldBase, ABC):
    data_type = BooleanType
    allowed_data_types = [BooleanType, bool]

    def validate_field_kwargs(self, value, model, field_name):
        pass

    def validate(self, value, field_name=None, model=None):
        value = super(BooleanProperty, self).validate(value, field_name=field_name, model=model)
        return self.convert_to_data_type(value, model, field_name)


"""
TODO - uncomment this when tests are working fine
class ByteProperty(FieldBase, ABC):
    data_type = ByteType
    allowed_data_types = [ByteType, bytes]

    def validate_field_kwargs(self, value, model, field_name):
        pass

    def validate(self, value, field_name=None, model=None):
        value = super(ByteProperty, self).validate(value, field_name=field_name, model=model)
        return self.data_type(value) if value else value
"""


class NumberFieldBase(FieldBase, ABC):
    allowed_data_types = [IntegerType, FloatType, LongType, DoubleType, int, float, long, ShortType]

    def __init__(self, min_value=None, max_value=None, **kwargs):
        super().__init__(**kwargs)
        self.min_value = min_value
        self.max_value = max_value

    def validate_field_kwargs(self, value, model, field_name):
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
            if hasattr(self.data_type, 'limit'):
                if value > self.data_type.limit - 1:
                    raise FieldValidationError(
                        f"max value allowed for '{self.data_type.__class__.__name__}' data type of "
                        f"field '{model.label_name}.{field_name}'"
                        f" is {self.data_type.limit - 1} but the value has {value}")
                if value < 0 - self.data_type.limit:
                    raise FieldValidationError(
                        f"min_value allowed for '{self.data_type.__class__.__name__}' data type of "
                        f"field '{model.label_name}.{field_name}'"
                        f" is {self.min_value} but the value has {value}")

    def validate(self, value, field_name=None, model=None):
        value = super(NumberFieldBase, self).validate(value, field_name=field_name, model=model)
        return self.convert_to_data_type(value, model, field_name)


class ShortProperty(NumberFieldBase, ABC):
    data_type = ShortType


class IntegerProperty(NumberFieldBase, ABC):
    data_type = IntegerType


class LongProperty(NumberFieldBase, ABC):
    data_type = LongType


class FloatProperty(NumberFieldBase, ABC):
    data_type = FloatType


class DoubleProperty(NumberFieldBase, ABC):
    data_type = DoubleType


class DateTimeProperty(FieldBase, ABC):
    data_type = DateTimeType
    allowed_data_types = [DateTimeType, datetime.datetime]

    def __init__(self, min_value=None, max_value=None, **kwargs):
        super().__init__(**kwargs)
        self.min_value = min_value
        self.max_value = max_value

    def get_data_type_class(self):
        return "Date"

    def validate_field_kwargs(self, value, model, field_name):
        if value and not isinstance(value, tuple(self.allowed_data_types)):
            raise FieldValidationError(f"field '{model.label_name}.{field_name}' cannot be of "
                                       f"type {type(value)}, expecting {self.data_type}")
        if self.max_value and not isinstance(self.max_value, tuple(self.allowed_data_types)):
            raise FieldValidationError(f"field '{model.label_name}.{field_name}' cannot be of "
                                       f"type {type(self.max_value)}, expecting {self.data_type}")
        if self.min_value and not isinstance(value, tuple(self.allowed_data_types)):
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

    def validate(self, value, field_name=None, model=None):
        value = super(DateTimeProperty, self).validate(value, field_name=field_name, model=model)
        return self.convert_to_data_type(value, model, field_name)

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
