from invana_py.connector.connector import GremlinConnector

gremlin_url = "ws://megamiwnd-ws:8182/gremlin"
connection = GremlinConnector(gremlin_url)
# connection.close()
response = connection.execute_query("g.V().count().next()", raise_exception=True)
# # response = connection.execute_query("g.V().limit(100).toList()")
print("response", response)
#

# print("response", response.data.__len__())
# connection.close_connection()

# def callback(d):
#     pass
#     print("response", d.data.__len__(), d)
#
#
# connection.execute_query_with_callback(f"g.V().limit({response.data[0]}).toList()", callback,
#                                        finished_callback=lambda: connection.close_connection()
#                                        )
#
# connection.execute_query_with_callback("g.V().limit(1000).toList()", callback,
#                                        # finished_callback=lambda: connection.close_connection()
#                                        )

# connection.execute_query_with_callback("g.V().limit(1000).toList()", callback,
#                                        # finished_callback=lambda: connection.close_connection()
#                                        )

# result = connection.g.V().limit(1).next()
# result = connection.g.V().hasLabel("TestLabel").limit(response.data[0]).toList()
# print("====result", result)
# print("====result", result.__len__())

connection.close()
