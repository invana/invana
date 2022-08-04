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
from experiments.models import NodeModel, RelationshipModel
from invana.ogm.fields import StringProperty, DateTimeProperty, FloatProperty, IntegerProperty


class Star(NodeModel):
    name = StringProperty(max_length=10, trim_whitespaces=True)
    mass_in_kgs = FloatProperty()
    radius_in_kms = IntegerProperty()


all_stars = Star.objects.search().to_list()
print(all_stars)
