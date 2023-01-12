from invana import InvanaGraph

connection_uri = "ws://megamind.local:8182/gremlin"

graph = InvanaGraph(connection_uri)
result = graph.management.schema_reader.get_graph_schema()
print("result", result)
graph.close()
