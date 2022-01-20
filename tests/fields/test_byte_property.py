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
# from invana_py.ogm.fields import StringProperty, SingleCharProperty, ByteProperty
# from invana_py.ogm.models import VertexModel
# from invana_py.connector.data_types import ByteType
# from invana_py.serializer.element_structure import Node
# from invana_py import InvanaGraph
#
# gremlin_url = "ws://megamind-ws:8182/gremlin"
# graph = InvanaGraph(gremlin_url)
#
# DEFAULT_USERNAME = "rrmerugu"
#
#
# class Person(VertexModel):
#     graph = graph
#
#     properties = {
#         'first_name': StringProperty(min_length=3, max_length=30, trim_whitespaces=True),
#         'gender': SingleCharProperty(allow_null=True, default="m"),
#         'bytes_data': ByteProperty(default=b'xyz')
#     }
#
#
# class TestStringField:
#
#     def test_field(self):
#         graph.g.V().drop()
#         project = Person.objects.create(first_name="Ravi Raja", gender='m', bytes_data=ByteType(b'xyz'))
#         assert isinstance(project.properties.bytes_data, ByteType)
#
#     def test_field_exclusive_type(self):
#         graph.g.V().drop()
#         project = Person.objects.create(first_name="Ravi Raja", gender='m', bytes_data=ByteType(b'xyz'))
#         assert isinstance(project.properties.bytes_data, ByteType)
#
#     def test_field_allow_null(self):
#         graph.g.V().drop()
#
#         person = Person.objects.create(first_name="Ravi Raja")
#         assert isinstance(person, Node)
#
#     # def test_field_default(self):
#     #     graph.g.V().drop()
#     #     person = Person.objects.create(first_name="Ravi Raja")
#     #     assert person.properties.bytes_data == b'xyz'
