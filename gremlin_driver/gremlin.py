#  Copyright 2020 Invana
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#   http:www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

import asyncio
import logging
import uuid

from .core.exceptions import QueryFailedException
from .transporter import AiohttpTransport
from .typing import ResponseMessage, RequestMessage
from .utils import async_to_sync

logger = logging.getLogger(__name__)


class GremlinClient:

    def __init__(self,
                 gremlin_url,
                 gremlin_traversal_source="g",
                 loop=None,
                 read_timeout=3600, write_timeout=3600):
        self.gremlin_url = gremlin_url
        self.gremlin_traversal_source = gremlin_traversal_source
        self.loop = asyncio.get_event_loop() if loop is None else loop
        self.transporter = AiohttpTransport(read_timeout=read_timeout, write_timeout=write_timeout, loop=self.loop)

    async def prepare_message(self, gremlin_query):
        req = RequestMessage(query_string=gremlin_query, request_id=str(uuid.uuid4()),
                             traversal_source=self.gremlin_traversal_source)
        return req.get_request_data()

    @staticmethod
    async def get_status_code_from_response(response):
        return response.get("status", {}).get("code")

    @staticmethod
    async def serialize_response(response):
        return ResponseMessage(**response)

    async def throw_status_based_errors(self, query_string, status_code):
        if status_code != 206:
            await self.transporter.close()
        if status_code >= 300:
            logger.error("Failed with status code {}".format(status_code))
            raise QueryFailedException(
                "Query failed with status code {}. Query is : {}".format(status_code, query_string))

    async def execute_query(self, query_string, serialize=True):
        logger.debug("Executing query: {}".format(query_string))
        await self.transporter.connect(self.gremlin_url)
        message = await self.prepare_message(query_string)
        await self.transporter.write(message)
        responses = []
        response_data = await self.transporter.read()
        responses.append(response_data)
        status_code = await self.get_status_code_from_response(response_data)
        while status_code == 206:  # streaming, so read all the messages
            response_data = await self.transporter.read()
            # yield response_data
            status_code = await self.get_status_code_from_response(response_data)
            await self.throw_status_based_errors(query_string, status_code)
            responses.append(response_data)
        await self.throw_status_based_errors(query_string, status_code)
        # for response in responses:
        #     print("==response", response)
        # print(response_data)
        if serialize is True:
            return [ResponseMessage(**response_data) for response_data in responses]
        return responses

    def execute_query_as_sync(self, query_string, serialize=True):
        return self.async_to_sync(self.execute_query(query_string, serialize=serialize))

    def async_to_sync(self, func):
        # if self.loop.is_closed():
        #     return async_to_sync(func)
        return async_to_sync(func, self.loop)

    def close_connection(self):
        async_to_sync(self.transporter._session.close())
