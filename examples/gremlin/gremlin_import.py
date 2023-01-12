from invana import InvanaGraph

connection_uri = "ws://megamind.local:8182/gremlin"
graph = InvanaGraph(connection_uri)

total_nodes_to_create = 5
for i in range(0, total_nodes_to_create):
    graph.connector.g.addV("TestUser").property("name", f"Ravi {i}").next()
    print(f"Created {i}/{total_nodes_to_create}")

graph.close()
