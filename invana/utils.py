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


def get_running_loop():
    return asyncio.get_running_loop()


def async_to_sync(func, loop=None):
    if loop:
        return loop.run_until_complete(func)
    else:
        return asyncio.get_event_loop().run_until_complete(func)
