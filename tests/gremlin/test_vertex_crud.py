# #   Copyright 2021 Invana
# #  #
# #    Licensed under the Apache License, Version 2.0 (the "License");
# #    you may not use this file except in compliance with the License.
# #    You may obtain a copy of the License at
# #  #
# #    http:www.apache.org/licenses/LICENSE-2.0
# #  #
# #    Unless required by applicable law or agreed to in writing, software
# #   distributed under the License is distributed on an "AS IS" BASIS,
# #    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# #    See the License for the specific language governing permissions and
# #    limitations under the License.
# #
# from tests.sample_data import VERTICES_SAMPLES
# import pytest
# from invana_py.typing.elements import Node
# from invana_py import InvanaGraph
#
#
# class TestVertexCRUD:
#     @pytest.mark.asyncio
#     def test_vertex_create(self, graph):
#         for vertex in VERTICES_SAMPLES:
#             data = graph.vertex.create(**vertex)
#             assert data is not None
#             assert isinstance(data, Node)
#
#     @pytest.mark.asyncio
#     def test_read_one(self, graph: InvanaGraph):
#         old_data = graph.vertex.read_one(has__label="Star")
#         graph.vertex.delete_one(has__id=old_data.id)
#         data = graph.vertex.read_one(has__id=old_data.id)
#         assert data is None
#
#     @pytest.mark.asyncio
#     def test_delete_one(self, graph: InvanaGraph):
#         old_data = graph.vertex.read_one(has__label="Star")
#         graph.vertex.delete_one(has__id=old_data.id)
#         data = graph.vertex.read_one(has__id=old_data.id)
#         assert data is None
