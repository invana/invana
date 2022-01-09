from invana_py import InvanaGraph

gremlin_url = "ws://megamind-ws:8182/gremlin"

graph = InvanaGraph(gremlin_url)
result = graph.backend.schema_reader.get_graph_schema()
print("result==", result)
graph.close_connection()
