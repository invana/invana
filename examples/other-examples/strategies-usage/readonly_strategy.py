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
from invana import InvanaGraph
from invana.strategies import ReadOnlyStrategy

GREMLIN_SERVER_URL = 'ws://megamind.local:8182/gremlin'
graph = InvanaGraph(GREMLIN_SERVER_URL, strategies=[ReadOnlyStrategy, ])

graph.close_connection()
