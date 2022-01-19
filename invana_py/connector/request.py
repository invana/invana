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

from gremlin_python.driver.protocol import GremlinServerError
from invana_py.utils import create_uuid, get_elapsed_time, get_datetime
from .constants import RequestStateTypes, GremlinServerErrorStatusCodes, QueryResponseErrorReasonTypes
from .events import ResponseReceivedButFailedEvent, ResponseReceivedSuccessfullyEvent, \
    RequestFinishedSuccessfullyEvent, RequestFinishedButFailedEvent, RequestStartedEvent, ServerDisconnectedErrorEvent, \
    RunTimeErrorEvent, ClientConnectorErrorEvent


class RequestBase:
    created_at = None

    def __init__(self):
        self.request_id = create_uuid()
        self.created_at = get_datetime()

    def get_elapsed_time(self):
        return get_elapsed_time(get_datetime(), self.created_at)


class QueryRequest(RequestBase):
    state = None
    status_last_updated_at = None

    def __repr__(self):
        return f"<QueryRequest {self.request_id}>"

    def __init__(self, query: str, request_options: dict = None):
        super(QueryRequest, self).__init__()
        self.query = query
        self.request_options = request_options or {}
        self.started()

    def update_last_updated_at(self):
        self.status_last_updated_at = get_datetime()

    def started(self):
        self.state = RequestStateTypes.STARTED
        self.update_last_updated_at()
        RequestStartedEvent(self)

    def response_received_but_failed(self, exception: GremlinServerError):
        self.state = RequestStateTypes.RESPONSE_RECEIVED
        self.update_last_updated_at()
        if getattr(exception, "status_code"):
            error_reason = None
            gremlin_server_error = None
            if exception.status_code == 597:
                gremlin_server_error = getattr(GremlinServerErrorStatusCodes, f"ERROR_{exception.status_code}")
                error_reason = QueryResponseErrorReasonTypes.INVALID_QUERY
                ResponseReceivedButFailedEvent(self, exception.status_code, exception)

    def response_received_successfully(self, status_code):
        self.state = RequestStateTypes.RESPONSE_RECEIVED
        self.update_last_updated_at()
        ResponseReceivedSuccessfullyEvent(self, status_code)

    def finished_with_failure(self, exception: GremlinServerError):
        self.state = RequestStateTypes.FINISHED
        self.update_last_updated_at()
        RequestFinishedButFailedEvent(self, exception)

    def finished_with_success(self):
        self.state = RequestStateTypes.FINISHED
        self.update_last_updated_at()
        RequestFinishedSuccessfullyEvent(self)

    def server_disconnected_error(self, e):
        self.state = RequestStateTypes.SERVER_DISCONNECTED
        self.update_last_updated_at()
        ServerDisconnectedErrorEvent(self, e)

    def runtime_error(self, e):
        self.state = RequestStateTypes.RUNTIME_ERROR
        self.update_last_updated_at()
        RunTimeErrorEvent(self, e)

    def client_connection_error(self, e):
        self.state = RequestStateTypes.CLIENT_CONNECTION_ERROR
        self.update_last_updated_at()
        ClientConnectorErrorEvent(self, e)
