from invana_py.connector.connector import GremlinConnector

gremlin_url = "ws://megamind-ws:8182/gremlin"
connection = GremlinConnector(gremlin_url)


# response = connection.execute_query("g.V().count().next()")
# response = connection.execute_query("g.V().limit(100).toList()")
# print("response", response.data)
# print("response", response.data.__len__())
# connection.close_connection()

def callback(d):
    print("d", d)
    print("d", d.data.__len__())


connection.execute_query_with_callback("g.V().limit(1000).toList()", callback,
                                       finished_callback=lambda: connection.close_connection()
                                       )

connection.close_connection()