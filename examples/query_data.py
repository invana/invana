from invana_py.connector.connector import GremlinConnector

gremlin_url = "ws://megamind-ws:8182/gremlin"
connector = GremlinConnector(gremlin_url)
connector.g.V().drop().iterate()
connector.g.addV("Organisation").property("name", "invana").next()
connector.g.addV("Project").property("name", "invana engine").next()
connector.g.addV("Project").property("name", "invana studio").next()
user = connector.g.addV("User").property("name", "Ravi").next()

response = connector.execute_query(f"g.V().hasLabel('{user.label}').hasId({user.id}).elementMap().toList()")
print("response", response.data)

response = connector.g.V().hasLabel(user.label).hasId(user.id).elementMap().toList()
print("response", response)

connector.close()
