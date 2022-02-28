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
from invana.connector.data_types import LongType


class TestLongType:

    def test_long_type(self):
        a = LongType(9223372036854775807)
        assert isinstance(a, int)
        assert a == 9223372036854775807

    def test_long_type_failure(self):
        with pytest.raises(ValueError) as exec_info:
            LongType(9223372036854775808)
        assert exec_info.value.__str__() == 'LongType value must be between -9223372036854775808 and ' \
                                            '9223372036854775807 inclusive'
