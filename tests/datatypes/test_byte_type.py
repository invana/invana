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
from invana_py.connector.data_types import ByteType


class TestByteType:

    def test_byte_type(self):
        b = b'h\x65llo'
        b_instance = ByteType(b)
        assert isinstance(b_instance, bytes)
        assert b_instance == b

    def test_byte_type_when_string_input_utf8_encoding(self):
        b = "hello"
        b_instance = ByteType(b, 'utf-8')
        assert isinstance(b_instance, bytes)
        assert b_instance == b'hello'

    def test_byte_type_when_string_input_ascii_encoding(self):
        b = "hello"
        b_instance = ByteType(b, 'ascii')
        assert isinstance(b_instance, bytes)
        assert b_instance == b'hello'
