from invana.connector.connector import GremlinConnector
from invana import InvanaGraph
import logging
logging.basicConfig(filename="log.txt", filemode="w", level=logging.DEBUG)
gremlin_url = "ws://megamind-ws:8182/gremlin"
graph = InvanaGraph(gremlin_url)
print(graph.connector.gremlin_url)
# schema = graph.backend.schema_reader.get_graph_schema()
# print(schema)
# for k, vtx_schema in schema['vertices'].items():
#     print(vtx_schema.properties)
# graph.close_connection()
# connector = GremlinConnector(gremlin_url)
# # connector.close()
# response = connector.execute_query("g.V().count().next()")
# # response = connector.execute_query("g.V().limit(200).elementMap().toList()")
# response = graph.execute_query("mgmt = graph.openManagement(); mgmt.printSchema()")
# print(response.data)

# # response = connector.g.V().search().toList()
# print("response", response.data, response.data, )
#

response = graph.management.schema_reader.get_edge_schema("father")
print(response.link_paths)

graph.close_connection()
