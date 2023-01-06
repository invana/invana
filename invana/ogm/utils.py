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
#
import re
import copy
from invana.traversal.traversal import InvanaTraversal


def convert_to_camel_case(s):
    r = re.compile('((?<=[a-z0-9])[A-Z]|(?!^)[A-Z](?=[a-z]))')
    return r.sub(r'_\1', s).lower()



def copy_traversal(traversal):
    return InvanaTraversal(traversal.graph, traversal.traversal_strategies, copy.deepcopy(traversal.bytecode))
