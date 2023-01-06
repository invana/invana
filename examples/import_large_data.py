from invana import JanusGraphConnector

connection_uri = "ws://megamind.local:8182/gremlin"
connector = JanusGraphConnector(connection_uri)

for i in range(0, 300):
    connector.g.addV("TestUser").property("name", f"Ravi {i}").next()
    print(f"Created {i}/300")

connector.close()
