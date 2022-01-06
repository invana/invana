import pytest
import os


@pytest.fixture(scope="function")
def gremlin_url() -> str:
    return os.environ.get("GREMLIN_SERVER_URL", "ws://localhost:8182/gremlin")


@pytest.fixture(scope="function")
async def connection(gremlin_url):
    from invana_py.graph.connector import GremlinConnector
    connection = GremlinConnector(gremlin_url)
    # await graph.connect()
    # await initial_data(graph)
    yield connection
    # graph.vertex.delete_many()
    connection.close_connection()

#
# async def initial_data(graph):
#     user = await graph.vertex.get_or_create("User", properties={
#         "first_name": "Ravi",
#         "last_name": "Merugu",
#         "username": "rrmerugu"
#     })
#     print(user)
#
#     invana_studio_instance = await  graph.vertex.get_or_create("GithubProject", properties={
#         "name": "invana-studio",
#         "description": "opensource graph visualiser for Invana graph analytics engine"
#     })
#     print(invana_studio_instance)
#
#     invana_engine_instance = await graph.vertex.get_or_create("GithubProject", properties={
#         "name": "invana-engine",
#         "description": "Invana graph analytics engine"
#     })
#     print(invana_engine_instance)
#
#     studio_edge_instance = await graph.edge.get_or_create("authored", user.id, invana_studio_instance.id, properties={
#         "started": 2020
#     })
#     print(studio_edge_instance)
#
#     engine_edge_instance = await graph.edge.get_or_create("authored", user.id, invana_engine_instance.id, properties={
#         "started": 2020
#     })
#     print(engine_edge_instance)
