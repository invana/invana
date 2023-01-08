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
# https://docs.janusgraph.org/schema/index-management/index-performance/#graph-index
# two kinds of indexing to speed up query processing:
# 1.  graph indexes
# 2. vertex-centric indexes (a.k.a relation indexes)

class IndexBase:
    index_type = None

    def __init__(self, *fields, label=None):
        self.property_keys = fields
        self.label = label
        if self.property_keys.__len__() == 0:
            raise ValueError("at least one property key should be provided for creating indexing")
        self.index_name = self.get_index_name()

    def get_index_name(self):
        return f"{self.index_type}IndexBy{'' if self.label is None else self.label.capitalize()}" \
               f"{''.join([f.capitalize() for f in self.property_keys])}"

    def __repr__(self) -> str:
        property_keys_str = ",".join(self.property_keys)
        return f"<{self.index_type} (index_name={self.index_name}; label={self.label}; properties={property_keys_str} />"


class CompositeIndex(IndexBase):
    index_type = "Composite"


class MixedIndex(IndexBase):
    index_type = "Mixed"
