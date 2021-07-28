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
import json


class RequestMessage:
    DEFAULT_GREMLIN_VERSION = b"application/vnd.gremlin-v3.0+json"
    # DEFAULT_GREMLIN_VERSION = b"application/json"

    def __init__(self,
                 request_id=None,
                 query_string=None,
                 traversal_source=None,
                 session=None,
                 op="eval",
                 processor="traversal",  # ["", "session", "traversal"]
                 gremlin_version=None,
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
            'processor': ""
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
        self.op = op
        self.processor = processor
        self.session = session
        self.gremlin_version = gremlin_version or self.DEFAULT_GREMLIN_VERSION
        self.extra_query_args = extra_query_args

    def build_message(self):
        message = {
            "requestId": {'@type': 'g:UUID', '@value': self.request_id},
            'processor': self.processor,
            'op': self.op,
            "args": {
                "gremlin": self.query_string,
                "bindings": {},
                "language": "gremlin-groovy",
                "aliases": {"g": self.traversal_source},
                # "session": self._session,
            }
        }
        if self.session:
            message['args']['session'] = self.session
        message['args'].update(self.extra_query_args)
        # return self.finalize_message(message, b"\x21", self.gremlin_version)

        # return message
        return b'!application/vnd.gremlin-v3.0+json{"requestId": {"@type": "g:UUID", "@value": "14999201-9fff-47c4-9cc0-ad1e8ee9177f"}, "processor": "", "op": "eval", "args": {"gremlin": "g.V().hasLabel(\'person\').count()", "aliases": {"g": "all_food.g"}}}'
        #
        # return b'!application/vnd.gremlin-v3.0+json{"requestId": {"@type": "g:UUID", "@value": "67f3c21b-e8d0-40f1-bdee-84baa7b3fd87"}, "processor": "", "op": "eval", "args": {"gremlin": "g.V().hasLabel(\'person\').count()", "aliases": {"g": "all_food.g"}}}'
        # return message

    @staticmethod
    def finalize_message(message, mime_len, mime_type):
        message = json.dumps(message)
        message = b''.join([mime_len, mime_type, message.encode('utf-8')])
        return message
