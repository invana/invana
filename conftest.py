import pytest
import os


@pytest.fixture(scope="function")
def gremlin_url() -> str:
    return os.environ.get("GREMLIN_SERVER_URL", "ws://localhost:8182/gremlin")


@pytest.fixture(scope="function")
def connection(gremlin_url):
    from invana_py.connector.connector import GremlinConnector
    connection = GremlinConnector(gremlin_url)
    # await connector.connect()
    # await initial_data(connector)
    yield connection
    # connector.vertex.delete_many()
    connection.close()

#
# async def initial_data(connector):
#     user = await connector.vertex.get_or_create("User", properties={
#         "first_name": "Ravi",
#         "last_name": "Merugu",
#         "username": "rrmerugu"
#     })
#     print(user)
#
#     invana_studio_instance = await  connector.vertex.get_or_create("GithubProject", properties={
#         "name": "invana-studio",
#         "description": "opensource connector visualiser for Invana connector analytics engine"
#     })
#     print(invana_studio_instance)
#
#     invana_engine_instance = await connector.vertex.get_or_create("GithubProject", properties={
#         "name": "invana-engine",
#         "description": "Invana connector analytics engine"
#     })
#     print(invana_engine_instance)
#
#     studio_edge_instance = await connector.edge.get_or_create("authored", user.id, invana_studio_instance.id, properties={
#         "started": 2020
#     })
#     print(studio_edge_instance)
#
#     engine_edge_instance = await connector.edge.get_or_create("authored", user.id, invana_engine_instance.id, properties={
#         "started": 2020
#     })
#     print(engine_edge_instance)
