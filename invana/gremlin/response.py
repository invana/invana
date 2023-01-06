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

from invana.helpers.utils import get_datetime


class Response:

    def __init__(self, request_id, status_code, data=None, exception=None):
        self.request_id = request_id
        self.data = data
        self.status_code = status_code
        self.exception = exception
        self.created_at = get_datetime()

    def is_success(self):
        return False if self.exception else True

    def __repr__(self):
        return f"<Response:{self.request_id} status_code={self.status_code}>"
