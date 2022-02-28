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
import datetime
from .exceptions import ParserException

__all__ = ['StringType', 'SingleCharType', 'BooleanType', 'ShortType',
           'IntegerType', 'LongType', 'FloatType', 'DoubleType', 'DateTimeType']
# https://www.w3schools.com/java/java_data_types.asp

"""
[x] String	Character sequence
[x] Character	Individual character
[x] Boolean	true or false
[z] Byte	byte value
[x] Short	short value
[x] Integer	integer value
[x] Long	long value
[y] Float	4 byte floating point number
[y] Double	8 byte floating point number
[x] Date	Specific instant in time (java.util.Date)
[ ] Geoshape	Geographic shape like point, circle or box
[ ] UUID

* x=implementation done , y= incomplete implementation, z= implemented, but broken
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

#
# class SingleByteType(int):
#     """
#     Provides a way to pass a single byte via Gremlin.
#     """
#
#     def __new__(cls, b):
#         if -128 <= b < 128:
#             return int.__new__(cls, b)
#         else:
#             raise ValueError("value must be between -128 and 127 inclusive")


class ByteType(bytes):
    def __new__(cls, b, encoding=None):
        if isinstance(b, bytes):
            return bytes.__new__(cls, b)
        elif isinstance(b, str):
            assert encoding is not None, "encoding=None not allowed when str data is provided as input"
            return bytes.__new__(cls, b, encoding)
        else:
            raise ValueError(f"ByteType value must be between -32768 and 32767 inclusive")


class ShortType(int):
    """
    Provides a way to pass a short datatype via Gremlin.
    """
    limit = 32768

    def __new__(cls, b):
        if -32768 <= b < 32767:
            return int.__new__(cls, b)
        else:
            raise ValueError(f"ShortType value must be between -{cls.limit} and {cls.limit - 1} inclusive")


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


class LongType(int):
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


class DateTimeType(datetime.datetime):

    def __new__(cls, b, format=None):
        if isinstance(b, datetime.datetime):
            return b
        elif isinstance(b, str):
            assert format is not None, "format=None not allowed when str data is provided as input for DateTimeType"
            try:
                return datetime.datetime.strptime(b, format)
            except Exception as e:
                raise ParserException(f"Failed to parse string '{b}' with format '{format}'")
        else:
            raise ValueError(f"DateTimeType value must be datetime.datetime type or str with format ")


class DateType(datetime.date):

    def __new__(cls, b, format=None):
        if isinstance(b, datetime.date):
            return b
        elif isinstance(b, datetime.datetime):
            return b.date()
        elif isinstance(b, str):
            assert format is not None, "format=None not allowed when str data is provided as input for DateType"
            try:
                return datetime.datetime.strptime(b, format).date()
            except Exception as e:
                raise ParserException(f"Failed to parse string '{b}' with format '{format}'")
        else:
            raise ValueError(f"DateType value must be datetime.date type")

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
