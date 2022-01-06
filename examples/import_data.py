from invana_py.connector.connector import GremlinConnector
import uuid

graph = GremlinConnector("ws://localhost:8182/gremlin")
for i in range(1000):
    print(i)
    graph.g.addV("TestLabel").property("name", f"name-{uuid.uuid4().__str__()}").next()
graph.close_connection()
