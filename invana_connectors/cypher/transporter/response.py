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

from invana_connectors.core.base.transporter import ResponseBase
from ..serializer import convert_cypher_response_to_invana_objects


class CypherQueryResponse(ResponseBase):
    
    original_data = None

    def __init__(self, request_id, status_code, data=None, exception=None):
        self.original_data = data
        serialized_data = convert_cypher_response_to_invana_objects(data)
        super().__init__(request_id, status_code, data=serialized_data, exception=exception)
 

    