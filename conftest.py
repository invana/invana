import pytest
import os
from invana.gremlin.connector import GremlinConnector
from invana.backends.janusgraph.connector import JanusGraphConnector
from invana import InvanaGraph


@pytest.fixture(scope="function")
def gremlin_server_url() -> str:
    return os.environ.get("GREMLIN_SERVER_URL", "ws://megamind.local:8182/gremlin")

@pytest.fixture(scope="function")
def janusgraph_server_url() -> str:
    return os.environ.get("JANUSGRAPH_SERVER_URL", "ws://megamind.local:8184/gremlin")


@pytest.fixture(scope="function")
def gremlin_connector(gremlin_server_url):
    connector = GremlinConnector(gremlin_server_url)
    initial_data_with_connector(connector)
    yield connector
    connector.g.V().drop().iterate()
    connector.close()


@pytest.fixture(scope="function")
def janusgraph_connector(janusgraph_server_url):
    connector = JanusGraphConnector(janusgraph_server_url)
    initial_data_with_connector(connector)
    yield connector
    connector.g.V().drop().iterate()
    connector.close()

@pytest.fixture(scope="function")
def connectors_store(gremlin_connector, janusgraph_connector):
    # https://stackoverflow.com/a/42400786/3448851
    return {
        "gremlin_connector": gremlin_connector,
        "janusgraph_connector": janusgraph_connector
    }

@pytest.fixture(scope="function")
def graph(gremlin_server_url):
    graph = InvanaGraph(gremlin_server_url)
    initial_data_with_graph(graph)
    initial_data_with_connector(graph.connector)
    yield graph
    graph.connector.g.V().drop().iterate()
    graph.close()


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
