from invana.gremlin.connector import GremlinConnector
from invana import InvanaGraph
import logging
logging.basicConfig(filename="log.txt", filemode="w", level=logging.DEBUG)
connection_uri = "ws://megamind.local:8182/gremlin"
graph = InvanaGraph(connection_uri)

schema = graph.management.schema_reader.get_graph_schema()
print(schema)
for k, vtx_schema in schema['vertices'].items():
    print(vtx_schema.to_json())
for k, vtx_schema in schema['edges'].items():
    print(vtx_schema)
# graph.close_connection()
# connector = GremlinConnector(connection_uri)
# # connector.close()
# response = connector.execute_query("g.V().count().next()")
# # response = connector.execute_query("g.V().limit(200).elementMap().toList()")
# response = graph.execute_query("mgmt = graph.openManagement(); mgmt.printSchema()")
#
# # response = connector.g.V().search().toList()
# print("response", response.data, response.data, )
#
# print(response.data)
graph.close()
