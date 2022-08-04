from invana.connector.connector import GremlinConnector

gremlin_url = "ws://megamind-ws:8182/gremlin"
connector = GremlinConnector(gremlin_url)

for i in range(0, 300):
    node = connector.g.addV("TestUser").property("name", f"Ravi {i}").next()
    print(node)
connector.close()
