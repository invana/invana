from invana_py.connector.connector import GremlinConnector

gremlin_url = "ws://megamind-ws:8182/gremlin"
connector = GremlinConnector(gremlin_url)
# connector.close()
# response = connector.execute_query("g.V().count().next()")
# response = connector.execute_query("g.V().limit(200).elementMap().toList()")
response = connector.execute_query("mgmt = graph.openManagement(); mgmt.printSchema()")

# response = connector.g.V().search().toList()
print("response", response.data.__len__(), response.data, )

connector.close()
