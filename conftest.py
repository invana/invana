import pytest
import os


@pytest.fixture(scope="function")
def gremlin_url() -> str:
    return os.environ.get("GREMLIN_SERVER_URL", "ws://megamind-ws:8182/gremlin")


@pytest.fixture(scope="function")
def connection(gremlin_url):
    from invana_py.connector.connector import GremlinConnector
    connector = GremlinConnector(gremlin_url)
    initial_data(connector)
    yield connector
    connector.g.V().drop().iterate()
    connector.close()


#
def initial_data(connector):
    connector.g.addV("Organisation").property("name", "invana").next()
    connector.g.addV("Project").property("name", "invana engine").next()
    connector.g.addV("Project").property("name", "invana studio").next()
    connector.g.addV("User").property("name", "Ravi").next()

    for i in range(0, 10):
        connector.g.addV("TestUser").property("name", f"Ravi {i}").next()

    # user = connector.vertex.get_or_create("User", properties={
    #     "first_name": "Ravi",
    #     "last_name": "Merugu",
    #     "username": "rrmerugu"
    # })
    # print(user)
    #
    # invana_studio_instance = connector.vertex.get_or_create("GithubProject", properties={
    #     "name": "invana-studio",
    #     "description": "opensource connector visualiser for Invana connector analytics engine"
    # })
    # print(invana_studio_instance)
    #
    # invana_engine_instance = connector.vertex.get_or_create("GithubProject", properties={
    #     "name": "invana-engine",
    #     "description": "Invana connector analytics engine"
    # })
    # print(invana_engine_instance)
    #
    # studio_edge_instance = connector.edge.get_or_create("authored", user.id, invana_studio_instance.id,
    #                                                     properties={
    #                                                         "started": 2020
    #                                                     })
    # print(studio_edge_instance)
    #
    # engine_edge_instance = connector.edge.get_or_create("authored", user.id, invana_engine_instance.id,
    #                                                     properties={
    #                                                         "started": 2020
    #                                                     })
    # print(engine_edge_instance)
