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
from gremlin_python.statics import long, ListType, DictType, SetType, timestamp, \
    SingleChar

__all__ = ['StringType', 'SingleCharType', 'SingleByteType', 'BooleanType', 'ShortType',
           'IntegerType', 'LongType', 'FloatType', 'DoubleType', ]
# https://www.w3schools.com/java/java_data_types.asp

"""
String	Character sequence
Character	Individual character
Boolean	true or false
Byte	byte value
Short	short value
Integer	integer value
Long	long value
Float	4 byte floating point number
Double	8 byte floating point number
Date	Specific instant in time (java.util.Date)
Geoshape	Geographic shape like point, circle or box
UUID
"""


class StringType(str):
    pass


class SingleCharType(str):
    def __new__(cls, c):
        if len(c) == 1:
            return str.__new__(cls, c)
        else:
            raise ValueError("SingleCharType must contain only a single character")


class BooleanType:
    def __new__(cls, c):
        try:
            return bool(c)
        except Exception as e:
            raise e


class SingleByteType(int):
    """
    Provides a way to pass a single byte via Gremlin.
    """

    def __new__(cls, b):
        if -128 <= b < 128:
            return int.__new__(cls, b)
        else:
            raise ValueError("value must be between -128 and 127 inclusive")


class ByteType(bytes):
    pass


class ShortType(int):
    """
    Provides a way to pass a short datatype via Gremlin.
    """

    def __new__(cls, b):
        if -32768 <= b < 32767:
            return int.__new__(cls, b)
        else:
            raise ValueError(f"ShortType value must be between -32768 and 32767 inclusive")


class IntegerType(int):
    """
    Provides a way to pass a integer datatype via Gremlin.
    """
    limit = 2147483648

    def __new__(cls, b):
        if 0 - cls.limit <= b < cls.limit:
            return int.__new__(cls, b)
        else:
            raise ValueError(f"IntegerType value must be between -{cls.limit} and {cls.limit - 1} inclusive")


class LongType(long):
    """
    Provides a way to pass a long datatype via Gremlin.
    """
    limit = 9223372036854775808

    def __new__(cls, b):
        if 0 - cls.limit <= b < cls.limit:
            return int.__new__(cls, b)
        else:
            raise ValueError(f"LongType value must be between -{cls.limit} and {cls.limit - 1} inclusive")


class FloatType(float):
    pass


class DoubleType(float):
    pass


class DateTimeType(float):
    pass

# class UUIDType:
#     mport uuid
#
# def is_valid_uuid(val):
#
#     def __new__(cls, b):
#     if 0 - cls.limit <= b < cls.limit:
#         int.__new__(cls, b)
#     else:
#         raise ValueError(f"{cls.__class__.__name__}value must be between -{cls.limit} and {cls.limit} inclusive")
#
#
#     try:
#         uuid.UUID(str(val))
#         return True
#     except ValueError:
#         return False
