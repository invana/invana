from invana_py.connector.connector import GremlinConnector
from invana_py import InvanaGraph

gremlin_url = "ws://megamind-ws:8182/gremlin"
graph = InvanaGraph(gremlin_url)

schema = graph.backend.schema_reader.get_graph_schema()
print(schema)
graph.close_connection()
# connector = GremlinConnector(gremlin_url)
# # connector.close()
# response = connector.execute_query("g.V().count().next()")
# # response = connector.execute_query("g.V().limit(200).elementMap().toList()")
# response = connector.execute_query("mgmt = graph.openManagement(); mgmt.printSchema()")
#
# # response = connector.g.V().search().toList()
# print("response", response.data, response.data, )
#
# connector.close()
