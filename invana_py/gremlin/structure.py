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


class VertexCRUD:

    def __init__(self, gremlin_client=None):
        self.gremlin_client = gremlin_client

    def create(self, label=None, properties=None):
        _ = self.gremlin_client.g.addV(label)
        for k, v in properties.items():
            _.property(k, v)
        return _.next()

    def read_one(self, **query_kwargs) -> any:
        print("query_kwargs", query_kwargs)
        _ = self.gremlin_client.g
        for k, v in properties.items():
            _.property(k, v)
        return _.next()

    def update_one(self, query_kwargs=None, properties=None):
        pass

    def update_many(self, query_kwargs=None, properties=None):
        pass
