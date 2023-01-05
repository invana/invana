from invana.connector.connector import GremlinConnector

gremlin_url = "ws://megamind.local:8182/gremlin"
connector = GremlinConnector(gremlin_url)

for i in range(0, 300):
    connector.g.addV("TestUser").property("name", f"Ravi {i}").next()
    print(f"Created {i}/300")

connector.close()
