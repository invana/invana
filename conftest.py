import pytest
import os
from invana.connector.connector import GremlinConnector
from invana import graph, settings, InvanaGraph


@pytest.fixture(scope="function")
def gremlin_url() -> str:
    return os.environ.get("GREMLIN_SERVER_URL", "ws://megamind-ws:8182/gremlin")


@pytest.fixture(scope="function")
def connection(gremlin_url):
    connector = GremlinConnector(gremlin_url)
    initial_data_with_connector(connector)
    yield connector
    connector.g.V().drop().iterate()
    # connector.close()


@pytest.fixture(scope="function")
def graph(gremlin_url):
    settings.GREMLIN_URL = os.environ.get("GREMLIN_SERVER_URL", "ws://megamind-ws:8182/gremlin")

    from invana import graph
    initial_data_with_graph(graph)
    initial_data_with_connector(graph.connector)
    yield graph
    graph.g.V().drop().iterate()
    # graph.close_connection()


#
def initial_data_with_connector(connector: GremlinConnector):
    connector.g.addV("Organisation").property("name", "invana").next()
    connector.g.addV("Project").property("name", "invana engine").next()
    connector.g.addV("Project").property("name", "invana studio").next()
    connector.g.addV("User").property("name", "Ravi").next()
    for i in range(0, 10):
        connector.g.addV("TestUser").property("name", f"Ravi {i}").next()


def initial_data_with_graph(graph: InvanaGraph):
    graph.connector.execute_query("g.V().drop()")
    res = graph.connector.execute_query("g.V().count()")
    print("Res==========", res.data)
    is_created, user = graph.vertex.get_or_create(
        "User",
        first_name="Ravi", last_name="Merugu", username="rrmerugu")
    # print(user)

    is_created, invana_studio_instance = graph.vertex.get_or_create(
        "GithubProject",
        name="invana-studio", description="opensource graph visualiser")
    # print(invana_studio_instance)

    is_created, invana_engine_instance = graph.vertex.get_or_create(
        "GithubProject",
        name="invana-engine", description="Invana connector analytics engine"
    )
    # print(invana_engine_instance)

    is_created, studio_edge_instance = graph.edge.get_or_create(
        "authored", user.id, invana_studio_instance.id, started=2020)
    # print(studio_edge_instance)

    is_created, engine_edge_instance = graph.edge.get_or_create(
        "authored", user.id, invana_engine_instance.id, started=2020)
    # print(engine_edge_instance)
