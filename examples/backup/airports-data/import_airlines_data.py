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
"""
This script will import airlines data from Kevin Lawrence's book
https://github.com/krlawrence/graph/tree/master/sample-data
"""
from gremlin_connector import GremlinConnector
# from gremlin_connector.utils import async_to_sync
import csv


def import_data():
    node_id_map = {}
    graph_client = GremlinConnector("ws://megamind-ws:8182/gremlin", graph_backend="janusgraph")
    print("Initiating import: graph_client :", graph_client)

    with open('../../airlines-data/data/air-routes-latest-nodes.csv', encoding="utf8") as f:
        reader = csv.DictReader(f)
        for line in reader:
            cleaned_data = clean_nodes(line)
            created_data = graph_client.vertex.create(cleaned_data['label'],
                                                            properties=cleaned_data['properties'])
            print("Created Node", created_data)
            node_id_map[cleaned_data['id']] = created_data.id

    with open('../../airlines-data/data/air-routes-latest-edges.csv', encoding="utf8") as f:
        reader = csv.DictReader(f)
        for line in reader:
            cleaned_data = clean_edges(line)
            created_data = graph_client.edge.create(cleaned_data['label'],
                                                          node_id_map[cleaned_data['from']],
                                                          node_id_map[cleaned_data['to']],
                                                          properties=cleaned_data['properties'])
            print("Created Edge", created_data)


# async_to_sync(import_data())
import_data()
