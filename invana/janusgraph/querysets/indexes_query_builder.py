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

class IndexQueryBuilder:

    @staticmethod
    def create_index_query(*property_keys, label=None, index_name=None,
                           index_type: ['Mixed', 'Composite'] = None):
        if index_type not in ['Mixed', 'Composite']:
            raise Exception("index_type can only be 'Mixed' or 'Composite'")
        if index_name is None:
            index_name = f"{index_type}IndexBy{'' if label is None else label.capitalize()}" \
                         f"{''.join([k.capitalize() for k in property_keys])}"

        query = "\ngraph.tx().rollback()  //Never create new indexes while a transaction is active\n"
        query += "mgmt = graph.openManagement()\n"
        if label:
            query += f"{label} = mgmt.getVertexLabel('{label}')\n"

        for field in property_keys:
            query += f"{field} = mgmt.getPropertyKey('{field}')\n"

        query += f"mgmt.buildIndex('{index_name}', Vertex.class)" \
                 f"{''.join([f'.addKey({k})' for k in property_keys])}"
        if label:
            query += f".indexOnly({label})"
        if index_type == "Mixed":
            query += f".buildMixedIndex('search')\n"
        elif index_type == "Composite":
            query += f".buildCompositeIndex()\n"
        query += "mgmt.commit()\n"
        return query, index_name

    @staticmethod
    def wait_for_index_query(index_name):
        query = "//Wait for the index to become available\n"
        query += f"ManagementSystem.awaitGraphIndexStatus(graph, '{index_name}').call()\n\n"
        return query

    @staticmethod
    def reindex_query(index_name):
        query = "//Reindex the existing data\n"
        query += "mgmt = graph.openManagement()\n"
        query += "//Reindex the existing data\n"
        query += f'mgmt.updateIndex(mgmt.getGraphIndex("{index_name}"), SchemaAction.REINDEX).get()\n'
        query += "mgmt.commit()\n"
        return query

    @staticmethod
    def remove_index_query(index_name):
        query = f"""
graph.tx().rollback() 
// Disable the "name" composite index
mgmt = this.graph.openManagement()
{index_name} = mgmt.getGraphIndex('{index_name}')    
mgmt.updateIndex({index_name}, SchemaAction.DISABLE_INDEX).get()
mgmt.commit()
 
// Block until the SchemaStatus transitions from INSTALLED to REGISTERED
ManagementSystem.awaitGraphIndexStatus(graph, '{index_name}').status(SchemaStatus.DISABLED).call()

// Delete the index using JanusGraphManagement
mgmt = this.graph.openManagement()
{index_name} = mgmt.getGraphIndex('{index_name}')
mgmt.updateIndex({index_name}, SchemaAction.REMOVE_INDEX)
mgmt.commit()
"""
        return query
