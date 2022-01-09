from invana_py.connector.connector import GremlinConnector

gremlin_url = "ws://megamind-ws:8182/gremlin"
connector = GremlinConnector(gremlin_url)
# connector.close()
# response = connector.execute_query("g.V().count().next()")
# response = connector.execute_query("g.V().limit(200).elementMap().toList()")
response = connector.execute_query("mgmt = graph.openManagement(); mgmt.printSchema()")

# response = connector.g.V().search().toList()
print("response", response.data.__len__(), response.data, )
#

# print("response", response.data.__len__())
# connector.close_connection()

# def callback(d):
#     pass
#     print("response", d.data.__len__(), d)
#
#
# connector.execute_query_with_callback(f"g.V().limit({response.data[0]}).toList()", callback,
#                                        finished_callback=lambda: connector.close_connection()
#                                        )
#
# connector.execute_query_with_callback("g.V().limit(1000).toList()", callback,
#                                        # finished_callback=lambda: connector.close_connection()
#                                        )

# connector.execute_query_with_callback("g.V().limit(1000).toList()", callback,
#                                        # finished_callback=lambda: connector.close_connection()
#                                        )

# result = connector.g.V().limit(1).next()
# result = connector.g.V().hasLabel("TestLabel").limit(response.data[0]).toList()
# print("====result", result)
# print("====result", result.__len__())

connector.close()
