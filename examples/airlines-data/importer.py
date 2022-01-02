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
import csv
import urllib.request
from models import Airport, Version, Route
from datetime import datetime


class DataImporter:

    def __init__(self, gremlin_connector):
        self.gremlin_connector = gremlin_connector

    node_id_map = {}

    def clean_nodes(self, node_data):
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

    def clean_edges(self, edge_data):
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

    @staticmethod
    def get_final_data(data, keys=None):
        final_data = {}
        for k in keys:
            final_data[k] = data[k]
        return final_data

    def import_date(self, nodes_data_url, edges_data_url):
        with open(nodes_data_url, encoding="utf8") as f:
            reader = csv.DictReader(f)
            for line in reader:
                cleaned_data = self.clean_nodes(line)
                if cleaned_data['label'] == "airport":
                    final_data = self.get_final_data(cleaned_data['properties'], keys=list(Airport.properties.keys()))
                    final_data['runways'] = int(final_data['runways'])
                    final_data['longest'] = int(final_data['longest'])
                    final_data['elev'] = int(final_data['elev'])
                    final_data['lat'] = float(final_data['lat'])
                    final_data['lon'] = float(final_data['lon'])
                    created_data = Airport.objects.create(**final_data)
                elif cleaned_data['label'] == 'version':
                    final_data = self.get_final_data(cleaned_data['properties'], keys=list(Version.properties.keys()))
                    final_data['date'] = datetime.strptime(final_data['date'], '%Y-%m-%d %H:%M:%S %Z')
                    created_data = Version.objects.create(**final_data)
                self.node_id_map[cleaned_data['id']] = created_data.id
                print("Created Node", created_data)

        with open(edges_data_url, encoding="utf8") as f:
            reader = csv.DictReader(f)
            for line in reader:
                cleaned_data = self.clean_edges(line)
                properties = cleaned_data['properties']
                properties['dist'] = int(properties['dist']) if properties['dist'] else 0
                created_data = Route.objects.create(
                    self.node_id_map[cleaned_data['from']],
                    self.node_id_map[cleaned_data['to']],
                    properties=properties)
                print("Created Edge", created_data)
