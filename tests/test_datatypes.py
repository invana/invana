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
import pytest

from invana_py.connector.data_types import IntegerType, StringType, SingleByteType, ByteType


class TestDataTypes:


    def test_single_byte_type(self):
        a = SingleByteType(1)
        assert isinstance(a, int)
        assert a == 1

    def test_single_char_type(self):
        a = StringCharType("a")
        assert isinstance(a, str)
        assert a == "a"

    def test_byte_type(self):
        b = b'h\x65llo'
        a = ByteType(b)
        assert isinstance(a, bytes)
        assert a == b
