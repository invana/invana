from invana_py.graph.connector import GremlinConnector

gremlin_url = "ws://megamind-ws:8182/gremlin"
connection = GremlinConnector(gremlin_url)
result = connection.execute_query("g.V().limit(1).toList()")
print("result", result)
# assert isinstance(result, list)
connection.close_connection()
