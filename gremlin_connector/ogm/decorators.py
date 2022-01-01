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
from gremlin_connector.ogm.exceptions import ValidationError


def dont_allow_has_label_kwargs(**query_kwargs):
    keys = list(query_kwargs.keys())
    for k in keys:
        if k.startswith("has__label"):
            raise ValidationError("has__label search kwargs not allowed when using OGM")
