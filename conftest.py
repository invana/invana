# import pytest
# import os
# from invana.connector.connector import GremlinConnector
# from invana import InvanaGraph


# @pytest.fixture(scope="function")
# def gremlin_url() -> str:
#     return os.environ.get("GREMLIN_SERVER_URL", "ws://megamind.local:8182/gremlin")


# @pytest.fixture(scope="function")
# def connection(gremlin_url):
#     connector = GremlinConnector(gremlin_url)
#     initial_data_with_connector(connector)
#     yield connector
#     connector.g.V().drop().iterate()
#     connector.close()

 