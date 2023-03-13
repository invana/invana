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

import abc
from abc import ABC
from .base.constants import RequestStateTypes, GremlinServerErrorStatusCodes, QueryResponseStatusTypes
# from invana.connector.request import QueryRequest
from .utils import create_uuid, get_datetime, get_elapsed_time
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class QueryRequestEventBase:
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


class RequestStartedEvent(QueryRequestEventBase, ABC):
    state = RequestStateTypes.STARTED

    def __init__(self, request):
        super(RequestStartedEvent, self).__init__(request)
        self.log_event()

    def log_event(self):
        logger.debug(
            f"Request {self.request.request_id} {self.state} with "
            f"query: {self.request.query};; "
            f"request_options: {self.request.request_options};; at {self.created_at}")


class RequestFinishedSuccessfullyEvent(QueryRequestEventBase, ABC):
    state = RequestStateTypes.FINISHED
    status = QueryResponseStatusTypes.SUCCESS

    def __init__(self, request):
        super(RequestFinishedSuccessfullyEvent, self).__init__(request)
        self.log_event()

    def log_event(self):
        logger.debug(
            f"Request {self.request.request_id} {self.state} successfully "
            f"at {self.created_at}; elapsed_time {self.elapsed_time_ms}")


class RequestFinishedButFailedEvent(QueryRequestEventBase, ABC):
    state = RequestStateTypes.FINISHED
    status = QueryResponseStatusTypes.FAILED

    def __init__(self, request, exception):
        super(RequestFinishedButFailedEvent, self).__init__(request)

        self.status_code = exception.status_code if hasattr(exception, "status_code") else None
        self.gremlin_server_error = getattr(GremlinServerErrorStatusCodes, f"ERROR_{exception.status_code}") if \
            hasattr(exception, "status_code") else None
        self.log_event()

    def log_event(self):
        logger.error(
            f"Request {self.request.request_id} {self.state} with status code : "
            f"{self.status_code}:{self.gremlin_server_error} "
            f"at {self.created_at}; elapsed_time {self.elapsed_time_ms}")


class ResponseEventBase(QueryRequestEventBase, ABC):
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
        logger.error(
            f"Request {self.request.request_id} {self.state}:{self.status} with error {self.error_message} "
            f"at {self.created_at}; took {self.elapsed_time_ms}")


class ServerDisconnectedErrorEvent(QueryRequestEventBase, ABC):
    state = RequestStateTypes.SERVER_DISCONNECTED
    error_message = None

    def __init__(self, request, exception):
        super(ServerDisconnectedErrorEvent, self).__init__(request)
        self.error_message = exception.__str__()
        self.log_event()

    def log_event(self):
        logger.error(
            f"Request {self.request.request_id} {self.state} with error {self.error_message} "
            f"at {self.created_at}")


class RunTimeErrorEvent(QueryRequestEventBase, ABC):
    state = RequestStateTypes.RUNTIME_ERROR
    error_message = None

    def __init__(self, request, exception):
        super(RunTimeErrorEvent, self).__init__(request)
        self.error_message = exception.__str__()
        self.log_event()

    def log_event(self):
        logger.error(
            f"Request {self.request.request_id} {self.state} with error {self.error_message} "
            f"at {self.created_at}")


class ClientConnectorErrorEvent(QueryRequestEventBase, ABC):
    state = RequestStateTypes.CLIENT_CONNECTION_ERROR
    error_message = None

    def __init__(self, request, exception):
        super(ClientConnectorErrorEvent, self).__init__(request)
        self.error_message = exception.__str__()
        self.log_event()

    def log_event(self):
        logger.error(
            f"Request {self.request.request_id} {self.state} with error {self.error_message} "
            f"at {self.created_at}")
