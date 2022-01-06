from gremlin_python.driver.protocol import GremlinServerError

from invana_py.utils import create_uuid, get_elapsed_time, get_datetime
from datetime import datetime
from .constants import RequestStateTypes, GremlinServerErrorStatusCodes, QueryResponseErrorReasonTypes
from .events import ResponseReceivedButFailedEvent, ResponseReceivedSuccessfullyEvent, \
    RequestFinishedSuccessfullyEvent, RequestFinishedButFailedEvent, RequestStartedEvent


class RequestBase:
    created_at = None

    def __init__(self):
        self.request_id = create_uuid()
        self.created_at = get_datetime()

    def get_elapsed_time(self):
        return get_elapsed_time(get_datetime(), self.created_at)


class QueryRequest(RequestBase):
    status = None
    status_last_updated_at = None

    def __init__(self, query: str, request_options: dict = None):
        super(QueryRequest, self).__init__()
        self.query = query
        self.request_options = request_options or {}
        self.started()

    def update_last_updated_at(self):
        self.status_last_updated_at = get_datetime()

    def started(self):
        self.status = RequestStateTypes.STARTED
        self.update_last_updated_at()
        RequestStartedEvent(self)

    def response_received_but_failed(self, exception: GremlinServerError):
        self.status = RequestStateTypes.RESPONSE_RECEIVED
        self.update_last_updated_at()
        if getattr(exception, "status_code"):
            error_reason = None
            gremlin_server_error = None
            if exception.status_code == 597:
                gremlin_server_error = getattr(GremlinServerErrorStatusCodes, f"ERROR_{exception.status_code}")
                error_reason = QueryResponseErrorReasonTypes.INVALID_QUERY
                ResponseReceivedButFailedEvent(self, exception.status_code, exception)

    def respose_received_successully(self, status_code):
        self.status = RequestStateTypes.RESPONSE_RECEIVED
        self.update_last_updated_at()
        ResponseReceivedSuccessfullyEvent(self, status_code)

    def finished_with_failure(self, exception: GremlinServerError):
        self.status = RequestStateTypes.FINISHED
        self.update_last_updated_at()
        RequestFinishedButFailedEvent(self, exception)

    def finished_with_success(self):
        self.status = RequestStateTypes.FINISHED
        self.update_last_updated_at()
        RequestFinishedSuccessfullyEvent(self)

        pass
