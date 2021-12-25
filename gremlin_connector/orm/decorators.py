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

def close_connection(func):
    def do(self, *args, **kwargs):
        print("Creating connection now ")

        # crud = self.crud_cls(self.gremlin_connector)
        result = func(self, *args, **kwargs)
        print("Close connection now ")
        # self.crud.gremlin_connector.close_connection()
        return result

    return do


def create_connection(func):
    def do(self, *args, **kwargs):
        self.crud = self.crud_cls(self.gremlin_connector)

    return do
