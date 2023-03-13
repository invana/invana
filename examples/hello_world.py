from invana_connectors.backends import JanusGraphBackend, GenericGremlinBackend



graph_backend = GenericGremlinBackend("ws://megamind.local:8182/gremlin")
# add_result = graph_backend.execute_query("g.addV('Person').property('name', 'Ravi').next()")
result = graph_backend.execute_query("g.V().elementMap().toList()")
print(result)
print(result.data)
graph_backend.close()