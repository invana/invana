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
import pytest
from invana.connector.exceptions import ParserException
from invana.connector.data_types import DateType


class TestDateType:

    def test_date(self):
        d = datetime.date.today()
        a = DateType(d)
        assert isinstance(a, datetime.date)

    def test_date_with_datetime_input(self):
        d = datetime.datetime.now()
        a = DateType(d)
        assert isinstance(a, datetime.date)

    def test_date_parse(self):
        datetime_string = 'Jun 1 2005 1:33PM'
        a = DateType(datetime_string, format='%b %d %Y %I:%M%p')
        assert isinstance(a, datetime.date)

    def test_date_parse_failure(self):
        datetime_string = 'Jun 1 2005 1:33PM'
        with pytest.raises(ParserException):
            a = DateType(datetime_string, format='%b  %Y %I:%M%p')
