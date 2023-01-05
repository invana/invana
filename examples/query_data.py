from invana.gremlin.connector import GremlinConnector

connection_uri = "ws://megamind.local:8182/gremlin"
connector = GremlinConnector(connection_uri)
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
