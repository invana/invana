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


def extract_data_type(_type):
    # TODO - fix this for different backends later
    _d = _type.split("|")[2].strip()
    if "class java.lang" in _d:
        return _d.replace("class java.lang.", "")
    return _d.split(".")[-1]


def process_graph_schema_string(schema_string):
    schema = {
        "vertex_labels": {},
        "edge_labels": {},
        "property_keys": {},
    }
    if schema_string is None:
        return schema
    data_type = None
    __count = 0  # {2: vertex labels, 4: edge labels , 6: property names,
    for line in schema_string.split("\n"):
        if line.startswith("-------"):
            __count += 1
            continue
        if data_type == "vertices" and __count == 2:
            schema['vertex_labels'][line.split("|")[0].strip()] = {
                "name": line.split("|")[0].strip(),
                "partitioned": line.split("|")[1].strip(),
                "static": line.split("|")[2].strip(),
            }
        elif data_type == "edges" and __count == 4:
            schema['edge_labels'][line.split("|")[0].strip()] = {
                "name": line.split("|")[0].strip(),
                "directed": line.split("|")[1].strip(),
                "unidirected": line.split("|")[2].strip(),
                "multiplicity": line.split("|")[3].strip(),
            }
        elif data_type == "properties" and __count == 6:
            schema['property_keys'][line.split("|")[0].strip()] = {
                "name": line.split("|")[0].strip(),
                "cardinality": line.split("|")[1].strip(),
                "type": extract_data_type(line),
            }

        if line.startswith("Vertex Label Name"):
            data_type = "vertices"
        elif line.startswith("Edge Label Name"):
            data_type = "edges"
        elif line.startswith("Property Key Name"):
            data_type = "properties"
    return schema
