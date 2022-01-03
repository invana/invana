import pytest
import os

GREMLIN_SERVER_URL = os.environ.get("GREMLIN_SERVER_URL", "ws://localhost:8182/gremlin")


@pytest.fixture(scope="function")
async def graph():
    from invana_py import InvanaGraph
    graph = InvanaGraph(GREMLIN_SERVER_URL)
    await graph.connect()
    await initial_data(graph)
    c = graph.g.V().count().next()
    print("Count", c)
    yield graph
    graph.vertex.delete_many()
    await graph.close_connection()


async def initial_data(graph):
    user = graph.vertex.get_or_create("User", properties={
        "first_name": "Ravi",
        "last_name": "Merugu",
        "username": "rrmerugu"
    })
    print(user)

    invana_studio_instance = graph.vertex.get_or_create("GithubProject", properties={
        "name": "invana-studio",
        "description": "opensource graph visualiser for Invana graph analytics engine"
    })
    print(invana_studio_instance)

    invana_engine_instance = graph.vertex.get_or_create("GithubProject", properties={
        "name": "invana-engine",
        "description": "Invana graph analytics engine"
    })
    print(invana_engine_instance)

    studio_edge_instance = graph.edge.get_or_create("authored", user.id, invana_studio_instance.id, properties={
        "started": 2020
    })
    print(studio_edge_instance)

    engine_edge_instance = graph.edge.get_or_create("authored", user.id, invana_engine_instance.id, properties={
        "started": 2020
    })
    print(engine_edge_instance)
