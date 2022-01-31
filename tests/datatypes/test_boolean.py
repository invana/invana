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
from invana.connector.data_types import BooleanType


class TestBooleanType:

    def test_boolean_type(self):
        a = BooleanType(True)
        assert isinstance(a, bool)
        assert a is True

    def test_boolean_type_with_int(self):
        a = BooleanType(1)
        assert isinstance(a, bool)
        assert a is True

        a = BooleanType(0)
        assert isinstance(a, bool)
        assert a is False
