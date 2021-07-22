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
import aiohttp
import async_timeout
import json


class AiohttpTransport:
    nest_asyncio_applied = False

    # Default heartbeat of 5.0 seconds.
    def __init__(self, read_timeout=None, write_timeout=None, loop=None, **kwargs):
        # Start event loop and initialize websocket and client to None
        self._loop = loop
        self._websocket = None
        self._session = None

        # Set all inner variables to parameters passed in.
        self._aiohttp_kwargs = kwargs
        self._write_timeout = write_timeout
        self._read_timeout = read_timeout
        if "max_content_length" in self._aiohttp_kwargs:
            self._aiohttp_kwargs["max_msg_size"] = self._aiohttp_kwargs.pop("max_content_length")
        if "ssl_options" in self._aiohttp_kwargs:
            self._aiohttp_kwargs["ssl"] = self._aiohttp_kwargs.pop("ssl_options")

    async def connect(self, url, headers=None):
        # Start client session and use it to create a websocket with all the connection options provided.

        self._session = aiohttp.ClientSession(loop=self._loop)
        try:
            self._websocket = await self._session.ws_connect(url, **self._aiohttp_kwargs, headers=headers)
        except aiohttp.ClientResponseError as err:
            # If 403, just send forbidden because in some cases this prints out a huge verbose message
            # that includes credentials.
            if err.status == 403:
                raise Exception('Failed to connect to server: HTTP Error code 403 - Forbidden.')
            else:
                raise

    async def write(self, message):
        async with async_timeout.timeout(self._write_timeout):
            await self._websocket.send_str(json.dumps(message, default=str))

    async def read(self):
        # Inner function to perform async read.
        async with async_timeout.timeout(self._read_timeout):
            msg = await self._websocket.receive()

            # Need to handle multiple potential message types.
            if msg.type == aiohttp.WSMsgType.close:
                # Server is closing connection, shutdown and throw exception.
                await self.close()
                raise RuntimeError("Connection was closed by server.")
            elif msg.type == aiohttp.WSMsgType.closed:
                # Should not be possible since our loop and socket would be closed.
                raise RuntimeError("Connection was already closed.")
            elif msg.type == aiohttp.WSMsgType.error:
                # Error on connection, try to convert message to a string in error.
                raise RuntimeError("Received error on read: '" + str(msg.data) + "'")
            elif msg.type == aiohttp.WSMsgType.text:
                # Convert message to bytes.
                data = msg.data.strip().encode('utf-8')
            else:
                # General handle, return byte data.
                data = msg.data
            return json.loads(data)

    async def close(self):
        # If the loop is not closed (connection hasn't already been closed)
        if not self._loop.is_closed():
            # Execute the async close synchronously.
            if not self._websocket.closed:
                await self._websocket.close()
            if not self._session.closed:
                await self._session.close()

            # Close the event loop.
            if not self._loop.is_running():
                self._loop.close()

    @property
    def closed(self):
        # Connection is closed if either the websocket or the client session is closed.
        return self._websocket.closed or self._session.closed
