#   Copyright 2021 Invana
#  #
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#  #
#    http:www.apache.org/licenses/LICENSE-2.0
#  #
#    Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
#
import logging
from abc import ABC
from datetime import datetime
from invana_py.utils import create_uuid


class QueryStatusTypes:
    STARTED = "STARTED"
    RESPONSE_RECEIVED = "RESPONSE_RECEIVED"  # this status can be many for async execution
    FINISHED = "FINISHED"

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


class QueryEventBase:
    event_id = None
    event_status = None
    created_at = None

    @staticmethod
    def get_datetime():
        return datetime.now()

    def log_event(self):
        raise NotImplementedError()


class QueryEvent(QueryEventBase):
    request_payload = None

    def __init__(self, request_payload):
        if request_payload is None:
            raise Exception("request_payload cannot be None")
        self.event_id = create_uuid()
        self.event_status = QueryStatusTypes.STARTED
        self.created_at = self.get_datetime()
        self.request_payload = request_payload
        self.log_event()

    def get_elapsed_time(self):
        return (self.get_datetime() - self.created_at).total_seconds()

    def log_event(self):
        logging.debug(f"Query Event {self.event_id} {self.event_status} at {self.created_at}")


class QueryResponseEventBase(QueryEventBase, ABC):
    elapsed_time = None

    def __init__(self, event_id, elapsed_time):
        self.event_id = event_id
        self.created_at = self.get_datetime()
        self.elapsed_time = elapsed_time
        if self.event_status not in QueryStatusTypes.get_allowed_types():
            raise Exception(f"Invalid QueryEvent status {self.event_status}")
        self.log_event()


class QueryResponseReceivedSuccessfullyEvent(QueryResponseEventBase):
    event_status = QueryStatusTypes.RESPONSE_RECEIVED
    response_status = QueryResponseStatusTypes.SUCCESS

    def __init__(self, event_id, elapsed_time):
        super(QueryResponseReceivedSuccessfullyEvent, self).__init__(event_id, elapsed_time)

    def log_event(self):
        logging.debug(f"Query Event {self.event_id} {self.event_status} with response {self.response_status} "
                      f"at {self.created_at}; elapsed_time {self.elapsed_time}")


class QueryResponseReceivedWithErrorEvent(QueryResponseEventBase):
    event_status = QueryStatusTypes.RESPONSE_RECEIVED
    response_status = QueryResponseStatusTypes.FAILED

    error_reason = None
    error_message = None

    def __init__(self, event_id, elapsed_time, error_reason=None, error_message=None):
        if error_reason not in QueryResponseErrorReasonTypes.get_allowed_types():
            raise Exception(f"error_reason cannot be {error_reason}")
        super(QueryResponseReceivedWithErrorEvent, self).__init__(event_id, elapsed_time)
        self.error_reason = error_reason
        self.error_message = error_message

    def log_event(self):
        logging.debug(f"Query Event {self.event_id} {self.event_status} with response {self.response_status} "
                      f"at {self.created_at}; elapsed_time {self.elapsed_time}; error_reason {self.error_reason}")


class QueryFinishedEvent(QueryResponseEventBase):
    event_status = QueryStatusTypes.FINISHED

    def log_event(self):
        logging.debug(f"Query Event {self.event_id} {self.event_status}; elapsed_time {self.elapsed_time}")
