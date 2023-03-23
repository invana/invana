from invana_connectors.backends import Neo4jBackend

graph_backend = Neo4jBackend("neo4j://localhost:7687", auth=("neo4j", "test"))
records  = graph_backend.execute_query("match (n:ADEPTJob)<-[r:has_job]-(p:Project) return n, p,r  limit 5 ")
# records  = graph_backend.execute_query("match (n:Person) return n.name  limit 5 ")
# records  = graph_backend.execute_query("match (n:Person) return count(n)")
print(records.data)
# node = graph_backend.nodes.create("Person", name = "Ravi")
# print(node)