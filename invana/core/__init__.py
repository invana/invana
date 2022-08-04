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
from .invana import InvanaGraph
from .. import settings

graph = InvanaGraph(settings.GREMLIN_URL,
                    traversal_source=settings.TRAVERSAL_SOURCE,
                    strategies=settings.STRATEGIES,
                    read_only_mode=settings.READONLY_MODE,
                    timeout=settings.TIMEOUT,
                    graph_traversal_source_cls=settings.GRAPH_TRAVERSAL_SOURCE_CLS,
                    call_from_event_loop=settings.CALL_FROM_EVENT_LOOP,
                    deserializer_map=settings.DESERIALIZER_MAP,
                    auth=settings.AUTH)
