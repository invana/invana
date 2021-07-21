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


class RequestMessage:

    def __init__(self,
                 request_id=None,
                 query_string=None,
                 traversal_source=None,
                 session=None,
                 args=None, op="eval",
                 processor="",
                 **extra_query_args
                 ):
        """
        Example usage:

        query_message = {
            "requestId": request_id,
            "args": {
                "gremlin": gremlin_query,
                "bindings": {},
                "language": "gremlin-groovy",
                "aliases": {"g": self.gremlin_traversal_source},
                "session": request_id
            },
            'op': "eval",
            'processor': processor
        }
        req = RequestMessage(**query_message)
        message_dict = req.get_request_data()

        :param request_id:
        :param query_string:
        :param traversal_source:
        :param session:
        :param args:
        :param op:
        :param processor:
        :param extra_query_args:
        """

        self.request_id = request_id
        self.query_string = query_string
        self.traversal_source = traversal_source
        self.args = args
        self.op = op
        self.processor = processor
        self._session = session or request_id
        self.extra_query_args = extra_query_args

    def get_request_data(self):
        template = {
            "requestId": self.request_id,
            "args": {
                "gremlin": self.query_string,
                "bindings": {},
                "language": "gremlin-groovy",
                "aliases": {"g": self.traversal_source},
                "session": self._session
            },
            'op': "eval",
            'processor': self.processor
        }
        template['args'].update(self.extra_query_args)
        return template
