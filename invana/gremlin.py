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
import base64

from .core.exceptions import QueryFailedException
from .transporter import AiohttpTransport
from .typing import ResponseMessage, RequestMessage
from .utils import async_to_sync

logger = logging.getLogger(__name__)


class GremlinClient:

    def __init__(self,
                 gremlin_url,
                 traversal_source="g",
                 loop=None,
                 gremlin_version=None,
                 username=None,
                 password=None,
                 read_timeout=3600, write_timeout=3600):
        self.gremlin_url = gremlin_url
        self.traversal_source = traversal_source
        self.loop = asyncio.get_event_loop() if loop is None else loop
        self.gremlin_version = gremlin_version
        self._username = username
        self._password = password
        self.transporter = AiohttpTransport(read_timeout=read_timeout, write_timeout=write_timeout,
                                            loop=self.loop, password=password, username=username)

    async def create_request_message(self, request_id, gremlin_query):
        return RequestMessage(
            query_string=gremlin_query,
            request_id=request_id,
            traversal_source=self.traversal_source,
            gremlin_version=self.gremlin_version,

        ).build_query_message()

    async def create_auth_request_message(self, request_id):
        return RequestMessage(
            request_id=request_id,
            username=self.transporter._username,
            password=self.transporter._password).build_auth_message()

    @staticmethod
    async def get_status_code_from_response(response):
        return response.get("status", {}).get("code")

    @staticmethod
    async def serialize_response(response):
        return ResponseMessage(**response)

    async def throw_status_based_errors(self, query_string, status_code, response):
        if status_code == 407:
            return
        elif status_code == 401:
            await self.transporter.close()
            raise Exception(response['status']['message'])
        elif status_code != 206:
            await self.transporter.close()
        elif status_code >= 300:
            logging.error(response)
            logger.error("Query failed with status code: {}.. Status message: {}.. Query is: {}".format(
                status_code, response.get("status", {}).get("message"), query_string))
            raise QueryFailedException(
                "Query failed with status code: {}.. Status message: {}.. Query is: {}".format(
                    status_code, response.get("status", {}).get("message"), query_string))

    async def send_message(self, message):
        await self.transporter.write(message)

    async def receive_message(self):
        return await self.transporter.read()

    async def execute_query(self, query_string, serialize=True, result_only=True):
        logger.debug("Executing query: {}".format(query_string))
        await self.transporter.connect(self.gremlin_url)

        request_id = uuid.uuid4().__str__()
        message = await self.create_request_message(request_id, query_string)
        await self.send_message(message)
        responses = []
        response_data = await self.receive_message()
        status_code = await self.get_status_code_from_response(response_data)
        if status_code == 407:
            # if authentication is needed, this will ping the server with auth info.
            message = await self.create_auth_request_message(request_id)
            await self.send_message(message)
            response_data = await self.receive_message()
            status_code = await self.get_status_code_from_response(response_data)
            await self.throw_status_based_errors(query_string, status_code, response_data)

        await self.throw_status_based_errors(query_string, status_code, response_data)
        responses.append(response_data)

        while status_code == 206:  # streaming, so read all the messages
            response_data = await self.receive_message()
            status_code = await self.get_status_code_from_response(response_data)
            await self.throw_status_based_errors(query_string, status_code, response_data)
            responses.append(response_data)
        await self.throw_status_based_errors(query_string, status_code, response_data)
        if serialize is True:
            serialized_responses = [ResponseMessage(**response_data) for response_data in responses]
            if result_only is True:
                return [element for response in serialized_responses for element in response.result.data or []]
            return serialized_responses
        else:
            if result_only is True:

                return [element for response in responses for element in response['result']['data']['@value'] or []]
        return responses

    def execute_query_as_sync(self, query_string, serialize=True, result_only=True):
        return self.async_to_sync(self.execute_query(query_string, serialize=serialize, result_only=result_only))

    def async_to_sync(self, func):
        # if self.loop.is_closed():
        #     return async_to_sync(func)
        return async_to_sync(func, self.loop)

    def close_connection(self):
        async_to_sync(self.transporter._session.close())
