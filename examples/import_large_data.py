from invana_py.connector.connector import GremlinConnector

gremlin_url = "ws://megamind-ws:8182/gremlin"
connector = GremlinConnector(gremlin_url)

for i in range(0, 300):
    connector.g.addV("TestUser").property("name", f"Ravi {i}").next()

connector.close()
