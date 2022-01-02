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
from models import Airport, Version, Route
from importer import DataImporter
from connection import gremlin_connector


def delete_all_data():
    Airport.objects.delete_many()
    Version.objects.delete_many()
    Route.objects.delete_many()
    print("Deleted Airport, Version, Route data")


def import_data():
    importer = DataImporter(gremlin_connector)
    importer.import_date(
        # 'https://raw.githubusercontent.com/krlawrence/graph/master/sample-data/air-routes-latest-nodes.csv',
        # 'https://raw.githubusercontent.com/krlawrence/graph/master/sample-data/air-routes-latest-edges.csv'
        'data/air-routes-latest-nodes.csv',
        'data/air-routes-latest-edges.csv'
    )


def get_schema():
    return Airport.get_schema()


# delete_all_data()
# import_data()
schema = get_schema()
print("Airport schema", schema.get_property_keys())
print("Route schema", Route.get_schema().get_property_keys())
gremlin_connector.close_connection()
