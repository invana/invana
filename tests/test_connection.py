import pytest
from aiohttp import ClientConnectorError
from gremlin_python.driver.protocol import GremlinServerError
from invana.gremlin.connector import GremlinConnector
from invana.connector.response import Response


class TestConnection:

    def test_connection(self, connection_uri: str):
        connection = GremlinConnector(connection_uri)
        result = connection.execute_query("g.V().limit(1).toList()")
        assert isinstance(result, Response)
        connection.close()

    def test_query_failed_raise_exception(self, connection: GremlinConnector):
        with pytest.raises(GremlinServerError) as exec_info:
            result = connection.execute_query("g.V().limit(1).toist()", raise_exception=True)
            assert result.exception is not None

        assert isinstance(exec_info.value, GremlinServerError)

    def test_query_failed_dont_raise_exception(self, connection: GremlinConnector):
        result = connection.execute_query("g.V().limit(1).toist()", raise_exception=False)
        assert result.exception is not None

    def test_query_failed_with_gremlin_server_error_exception_with_raise_exception(self, connection: GremlinConnector):
        with pytest.raises(GremlinServerError) as exec_info:
            connection.execute_query("g.V().limit(1).toist()", raise_exception=True)
        assert isinstance(exec_info.value, GremlinServerError)

    # def test_query_failed_with_runtime_error_exception_with_raise_exception(self, connection: GremlinConnector):
    #     connection.close()
    #     with pytest.raises(RuntimeError) as exec_info:
    #         connection.execute_query("g.V().limit(1).toList()", raise_exception=True)
    #     assert isinstance(exec_info.value, RuntimeError)

    # def test_query_failed_with_timeout_exception_with_raise_exception(self, connection: GremlinConnector):
    #     connection.close()
    #     ERROR_598 = "SERVER ERROR TIMEOUT"
    #     with pytest.raises(GremlinServerError) as exec_info:
    #         connection.execute_query("g.V().limit(1).toList()", raise_exception=True)
    #     assert isinstance(exec_info.value, GremlinServerError)

    def test_query_failed_with_client_connection_error_exception_with_raise_exception(self):
        connection = GremlinConnector("ws://invalid-host:8182/gremlin")
        with pytest.raises(ClientConnectorError) as exec_info:
            connection.execute_query("g.V().limit(1).toList()", raise_exception=True)
        assert isinstance(exec_info.value, ClientConnectorError)
        connection.close()
