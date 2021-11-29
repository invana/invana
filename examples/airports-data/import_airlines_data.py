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
#"""
This script will import airlines data from Kevin Lawrence's book
https://github.com/krlawrence/graph/tree/master/sample-data
"""
from invana_py__ import InvanaClient
from invana_py__.utils import async_to_sync
import csv


def clean_nodes(node_data):
    cleaned_data = {}
    for k, v in node_data.items():
        if k.startswith("~"):
            cleaned_data[k.lstrip('~')] = v
        elif ":" in k:
            cleaned_data[k.split(":")[0]] = v

    _id = cleaned_data['id']
    _label = cleaned_data['label']
    del cleaned_data['id']
    del cleaned_data['label']
    return {
        "id": _id,
        "label": _label,
        "properties": cleaned_data
    }


def clean_edges(edge_data):
    cleaned_data = {}
    for k, v in edge_data.items():
        if k.startswith("~"):
            cleaned_data[k.lstrip('~')] = v
        elif ":" in k:
            cleaned_data[k.split(":")[0]] = v

    _id = cleaned_data['id']
    _label = cleaned_data['label']
    _from = cleaned_data['from']
    _to = cleaned_data['to']
    del cleaned_data['id']
    del cleaned_data['label']
    del cleaned_data['from']
    del cleaned_data['to']
    return {
        "id": _id,
        "label": _label,
        "from": _from,
        "to": _to,
        "properties": cleaned_data
    }


async def import_data():
    node_id_map = {}
    graph_client = InvanaClient("ws://localhost:8182/gremlin")
    print("Initiating import: graph_client :", graph_client)

    with open('./air-routes-latest-nodes.csv') as f:
        reader = csv.DictReader(f)
        for line in reader:
            cleaned_data = clean_nodes(line)
            created_data = await graph_client.vertex.create(cleaned_data['label'],
                                                            properties=cleaned_data['properties'])
            print("Created Node", created_data)
            node_id_map[cleaned_data['id']] = created_data.id

    with open('./air-routes-latest-edges.csv') as f:
        reader = csv.DictReader(f)
        for line in reader:
            cleaned_data = clean_edges(line)
            created_data = await graph_client.edge.create(cleaned_data['label'],
                                                          node_id_map[cleaned_data['from']],
                                                          node_id_map[cleaned_data['to']],
                                                          properties=cleaned_data['properties'])
            print("Created Edge", created_data)


async_to_sync(import_data())
