from invana_py import InvanaGraph
gremlin_url = "ws://megamind-ws:8182/gremlin"

graph = InvanaGraph(gremlin_url)
# result = graph.vertex.create("TestLabel", name="Ravi").element_map()
result = graph.backend.schema_reader.connector.execute_query("g.V().limit(1).toList()")
# result = graph.execute_query("mgmt = graph.openManagement(); mgmt.printSchema()")
print(result)
graph.close_connection()
