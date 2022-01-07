import abc
from abc import ABC
from invana_py.connector.constants import RequestStateTypes, GremlinServerErrorStatusCodes, QueryResponseStatusTypes
# from invana_py.connector.request import QueryRequest
from invana_py.utils import create_uuid, get_datetime, get_elapsed_time
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class QueryRequestBase:
    state = None
    error_message = None

    def __init__(self, request):
        self.event_id = create_uuid()
        self.request = request
        self.created_at = get_datetime()

        self.start_time = request.status_last_updated_at
        self.end_time = get_datetime()
        self.elapsed_time_ms = get_elapsed_time(self.end_time, self.start_time)

    @abc.abstractmethod
    def log_event(self) -> None:
        pass

    def __repr__(self):
        return f"<{self.__class__.__name__}>"


class RequestStartedEvent(QueryRequestBase, ABC):
    state = RequestStateTypes.STARTED

    def __init__(self, request):
        super(RequestStartedEvent, self).__init__(request)
        self.log_event()

    def log_event(self):
        logger.debug(
            f"Request {self.request.request_id} {self.state} with "
            f"query: {self.request.query};; "
            f"request_options: {self.request.request_options};; at {self.created_at}")


class RequestFinishedSuccessfullyEvent(QueryRequestBase, ABC):
    state = RequestStateTypes.FINISHED
    status = QueryResponseStatusTypes.SUCCESS

    def log_event(self):
        logger.debug(
            f"Request {self.request.request_id} {self.state} successfully "
            f"at {self.created_at}; elapsed_time {self.elapsed_time_ms}")


class RequestFinishedButFailedEvent(QueryRequestBase, ABC):
    state = RequestStateTypes.FINISHED
    status = QueryResponseStatusTypes.FAILED

    def __init__(self, request, exception):
        super(RequestFinishedButFailedEvent, self).__init__(request)

        self.status_code = exception.status_code if hasattr(exception, "status_code") else None
        self.gremlin_server_error = getattr(GremlinServerErrorStatusCodes, f"ERROR_{exception.status_code}") if \
            hasattr(exception, "status_code") else None
        self.log_event()

    def log_event(self):
        logger.debug(
            f"Request {self.request.request_id} {self.state} with status code : "
            f"{self.status_code}:{self.gremlin_server_error} "
            f"at {self.created_at}; elapsed_time {self.elapsed_time_ms}")


class ResponseEventBase(QueryRequestBase, ABC):
    state = RequestStateTypes.RESPONSE_RECEIVED
    status = None

    def __init__(self, request, status_code: int):
        super(ResponseEventBase, self).__init__(request)
        self.status_code = status_code


class ResponseReceivedSuccessfullyEvent(ResponseEventBase, ABC):
    status = QueryResponseStatusTypes.SUCCESS

    def __init__(self, request, status_code: int):
        super(ResponseReceivedSuccessfullyEvent, self).__init__(request, status_code)
        self.log_event()

    def log_event(self):
        logger.debug(
            f"Request {self.request.request_id} {self.state}:{self.status} with status code: "
            f"{self.status_code} at {self.created_at}; took {self.elapsed_time_ms}")


class ResponseReceivedButFailedEvent(ResponseEventBase, ABC):
    status = QueryResponseStatusTypes.FAILED
    error_message = None

    def __init__(self, request, status_code, exception):
        super(ResponseReceivedButFailedEvent, self).__init__(request, status_code)
        self.error_message = exception.__str__()
        self.log_event()

    def log_event(self):
        logger.debug(
            f"Request {self.request.request_id} {self.state}:{self.status} with error {self.error_message} "
            f"at {self.created_at}; took {self.elapsed_time_ms}")


class ServerDisconnectedErrorEvent(QueryRequestBase, ABC):
    state = RequestStateTypes.SERVER_DISCONNECTED
    error_message = None

    def __init__(self, request, exception):
        super(ServerDisconnectedErrorEvent, self).__init__(request)
        self.error_message = exception.__str__()
        self.log_event()

    def log_event(self):
        logger.debug(
            f"Request {self.request.request_id} {self.state} with error {self.error_message} "
            f"at {self.created_at}")


class RunTimeErrorEvent(QueryRequestBase, ABC):
    state = RequestStateTypes.RUNTIME_ERROR
    error_message = None

    def __init__(self, request, exception):
        super(RunTimeErrorEvent, self).__init__(request)
        self.error_message = exception.__str__()
        self.log_event()

    def log_event(self):
        logger.debug(
            f"Request {self.request.request_id} {self.state} with error {self.error_message} "
            f"at {self.created_at}")


class ClientConnectorErrorEvent(QueryRequestBase, ABC):
    state = RequestStateTypes.CLIENT_CONNECTION_ERROR
    error_message = None

    def __init__(self, request, exception):
        super(ClientConnectorErrorEvent, self).__init__(request)
        self.error_message = exception.__str__()
        self.log_event()

    def log_event(self):
        logger.debug(
            f"Request {self.request.request_id} {self.state} with error {self.error_message} "
            f"at {self.created_at}")

# class QueryRequestBase:
#     event_id = None
#     event_status = None
#     created_at = None
#
#     @staticmethod
#     def get_datetime():
#         return datetime.now()
#
#     def log_event(self):
#         raise NotImplementedError()
#
#
# class QueryEvent(QueryRequestBase):
#     request_payload = None
#
#     def __init__(self, request_payload):
#         if request_payload is None:
#             raise Exception("request_payload cannot be None")
#         self.event_id = create_uuid()
#         self.event_status = RequestStateTypes.STARTED
#         self.created_at = self.get_datetime()
#         self.request_payload = request_payload
#         self.log_event()
#
#     def get_elapsed_time(self):
#         return (self.get_datetime() - self.created_at).total_seconds()
#
#     def log_event(self):
#         logger.debug(f"Query Event {self.event_id} {self.event_status} at {self.created_at}")
#
#
# class QueryResponseEventBase(QueryRequestBase, ABC):
#     elapsed_time = None
#
#     def __init__(self, event_id, elapsed_time):
#         self.event_id = event_id
#         self.created_at = self.get_datetime()
#         self.elapsed_time = elapsed_time
#         if self.event_status not in RequestStateTypes.get_allowed_types():
#             raise Exception(f"Invalid QueryEvent status {self.event_status}")
#         self.log_event()
#
#
# class QueryResponseReceivedSuccessfullyEvent(QueryResponseEventBase):
#     event_status = RequestStateTypes.RESPONSE_RECEIVED
#     response_status = QueryResponseStatusTypes.SUCCESS
#
#     def __init__(self, event_id, elapsed_time):
#         super(QueryResponseReceivedSuccessfullyEvent, self).__init__(event_id, elapsed_time)
#
#     def log_event(self):
#         logger.debug(f"Query Event {self.event_id} {self.event_status} with response {self.response_status} "
#                       f"at {self.created_at}; elapsed_time {self.elapsed_time}")
#
#
# class QueryResponseReceivedWithErrorEvent(QueryResponseEventBase):
#     event_status = RequestStateTypes.RESPONSE_RECEIVED
#     response_status = QueryResponseStatusTypes.FAILED
#
#     error_reason = None
#     error_message = None
#
#     def __init__(self, event_id, elapsed_time, error_reason=None, error_message=None):
#         if error_reason not in QueryResponseErrorReasonTypes.get_allowed_types():
#             raise Exception(f"error_reason cannot be {error_reason}")
#         super(QueryResponseReceivedWithErrorEvent, self).__init__(event_id, elapsed_time)
#         self.error_reason = error_reason
#         self.error_message = error_message
#
#     def log_event(self):
#         logger.debug(f"Query Event {self.event_id} {self.event_status} with response {self.response_status} "
#                       f"at {self.created_at}; elapsed_time {self.elapsed_time}; error_reason {self.error_reason}")
#
#
# class QueryFinishedEvent(QueryResponseEventBase):
#     event_status = RequestStateTypes.FINISHED
#
#     def log_event(self):
#         logger.debug(f"Query Event {self.event_id} {self.event_status}; elapsed_time {self.elapsed_time}")
