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
import uuid
from datetime import datetime


def register_query_event(query_string):
    e = QueryEvent(query=query_string)
    print("\nquery_event", e)


class Event:
    event_id = None
    type = None
    payload = None
    created_at = None

    def __init__(self, payload=None):
        self.created_at = self.get_datetime()
        self.event_id = self.create_uuid()
        self.payload = payload

    @staticmethod
    def create_uuid():
        return uuid.uuid4().__str__()

    @staticmethod
    def get_datetime():
        return datetime.now()


class QueryEvent(Event):
    type = "query"

    def __init__(self, query=None):
        if query is None:
            raise Exception("query param cannot be null for QueryEvent")
        payload = {"query_string": query}
        super(QueryEvent, self).__init__(payload=payload)

    def __str__(self):
        return f"<QueryEvent {self.event_id}> query={self.payload.get('query_string')}"
