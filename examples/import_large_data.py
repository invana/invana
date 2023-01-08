from invana import InvanaGraph

connection_uri = "ws://megamind.local:8182/gremlin"
graph = InvanaGraph(connection_uri)

for i in range(0, 300):
    graph.connector.g.addV("TestUser").property("name", f"Ravi {i}").next()
    print(f"Created {i}/300")

graph.close()
