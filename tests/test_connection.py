from invana_py.graph.connector import GremlinConnector
import pytest
import logging

logging.getLogger('asyncio').setLevel(logging.INFO)
logging.basicConfig(filename='run.log', level=logging.DEBUG)


class TestConnection:

    def test_connection(self, gremlin_url: str):
        connection = GremlinConnector(gremlin_url)
        result = connection.execute_query("g.V().limit(1).toList()")
        assert isinstance(result, list)
        connection.close_connection()

    # def test_connection_with_timeout(self, gremlin_url: str):
    #     connection = GremlinConnector(gremlin_url)
    #     result = connection.execute_query("g.V().limit(1).toList()")
    #     assert isinstance(result, list)
    #     connection.close_connection()

    def test_query_failed_raise_exception(self, connection: GremlinConnector):
        result = connection.execute_query("g.V().limit(1).toist()", raise_exception=True)
        assert isinstance(result, list)
        connection.close_connection()

    def test_query_failed_dont_raise_exception(self, connection: GremlinConnector):
        result = connection.execute_query("g.V().limit(1).toist()", raise_exception=False)
        assert isinstance(result, list)
        connection.close_connection()
