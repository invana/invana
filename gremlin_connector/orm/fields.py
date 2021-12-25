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
from gremlin_python.statics import FloatType, LongType, SingleChar, SingleByte, ListType, SetType, ByteBufferType, \
    IntType
import abc


class ModelFieldBase:
    data_type = None

    def __init__(self, **kwargs):
        pass

    def get_data_type(self):
        return self.data_type

    def get_validator(self, **kwargs):
        return self.data_type

    def validated_data(self, **kwargs):
        return self.data_type()


class BooleanField(ModelFieldBase):
    data_type = bool


class ByteField(ModelFieldBase):
    data_type = ByteBufferType


class ShortField(ModelFieldBase):
    data_type = None


class IntegerField(ModelFieldBase):
    data_type = IntType


class LongField(ModelFieldBase):
    data_type = LongType


class FloatField(ModelFieldBase):
    data_type = FloatType


class DoubleField(ModelFieldBase):
    data_type = None


class StringField(ModelFieldBase):
    data_type = str


class GeoshapeField(ModelFieldBase):
    data_type = None


class DateField(ModelFieldBase):
    pass


class InstantField(ModelFieldBase):
    pass


class UUIDField(ModelFieldBase):
    pass
