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

class RequestStateTypes:
    STARTED = "STARTED"
    RESPONSE_RECEIVED = "RESPONSE_RECEIVED"  # this status can be many for async execution
    FINISHED = "FINISHED"
    SERVER_DISCONNECTED = "SERVER_DISCONNECTED"
    RUNTIME_ERROR = "RUNTIME_ERROR"
    CLIENT_CONNECTION_ERROR = "CLIENT_CONNECTION_ERROR"

    @classmethod
    def get_allowed_types(cls):
        return [k for k in list(cls.__dict__.keys()) if not k.startswith("__") and k.isupper()]


class QueryResponseStatusTypes:
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

    @classmethod
    def get_allowed_types(cls):
        return [k for k in list(cls.__dict__.keys()) if not k.startswith("__") and k.isupper()]


class QueryResponseErrorReasonTypes:
    # theses are error statuses when query response is received
    TIMED_OUT = "TIMED_OUT"
    INVALID_QUERY = "INVALID_QUERY"
    OTHER = "OTHER"

    @classmethod
    def get_allowed_types(cls):
        return [k for k in list(cls.__dict__.keys()) if not k.startswith("__") and k.isupper()]


class GremlinServerErrorStatusCodes:
    # move this to gremlin module
    ERROR_401 = "UNAUTHORIZED"
    ERROR_403 = "FORBIDDEN"
    ERROR_407 = "AUTHENTICATE"
    ERROR_497 = "REQUEST ERROR SERIALIZATION"
    ERROR_498 = "REQUEST ERROR MALFORMED REQUEST"
    ERROR_499 = "REQUEST ERROR INVALID REQUEST ARGUMENTS"
    ERROR_500 = "SERVER ERROR"
    ERROR_596 = "SERVER ERROR TEMPORARY"
    ERROR_597 = "SERVER ERROR EVALUATION"
    ERROR_598 = "SERVER ERROR TIMEOUT"
    ERROR_599 = "SERVER ERROR SERIALIZATION"


class ConnectionStateTypes:
    CONNECTED = "CONNECTED"
    CONNECTING = "CONNECTING"
    RECONNECTING = "RECONNECTING"
    DISCONNECTING = "DISCONNECTING"
    DISCONNECTED = "DISCONNECTED"
