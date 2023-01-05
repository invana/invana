from invana import InvanaGraph

gremlin_url = "ws://megamind.local:8182/gremlin"

graph = InvanaGraph(gremlin_url)
result = graph.backend.schema_reader.get_graph_schema()
print("result", result)
graph.close_connection()
