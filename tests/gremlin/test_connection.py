import pytest
from aiohttp import ClientConnectorError
from gremlin_python.driver.protocol import GremlinServerError
from invana.gremlin.connector import GremlinConnector
from invana.gremlin.transporter.response import GremlinQueryResponse
from conftest import gremlin_connector, janusgraph_connector

class TestGremlinConnection:

    # # https://stackoverflow.com/a/64246323/3448851
    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_connection(self, connectors_store, connector_name):
        connector = connectors_store[connector_name]
        res = connector.execute_query("g.V().limit(1).toList()")
        assert res.data.__len__()  > 0 

    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_query_failed_raise_exception(self, connectors_store, connector_name):
        connector = connectors_store[connector_name]
        with pytest.raises(GremlinServerError) as exec_info:
            result = connector.execute_query("g.V().limit(1).toist()", raise_exception=True)
            assert result.exception is not None

        assert isinstance(exec_info.value, GremlinServerError)

    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_query_failed_dont_raise_exception(self, connectors_store, connector_name):
        connector = connectors_store[connector_name]
        result = connector.execute_query("g.V().limit(1).toist()", raise_exception=False)
        assert result.exception is not None

    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_query_failed_with_gremlin_server_error_exception_with_raise_exception(self, connectors_store, connector_name):
        connector = connectors_store[connector_name]
        with pytest.raises(GremlinServerError) as exec_info:
            connector.execute_query("g.V().limit(1).toist()", raise_exception=True)
        assert isinstance(exec_info.value, GremlinServerError)

    # def test_query_failed_with_runtime_error_exception_with_raise_exception(self, connector: GremlinConnector):
    #     connector.close()
    #     with pytest.raises(RuntimeError) as exec_info:
    #         connector.execute_query("g.V().limit(1).toList()", raise_exception=True)
    #     assert isinstance(exec_info.value, RuntimeError)

    # def test_query_failed_with_timeout_exception_with_raise_exception(self, connector: GremlinConnector):
    #     connector.close()
    #     ERROR_598 = "SERVER ERROR TIMEOUT"
    #     with pytest.raises(GremlinServerError) as exec_info:
    #         connector.execute_query("g.V().limit(1).toList()", raise_exception=True)
    #     assert isinstance(exec_info.value, GremlinServerError)

    def test_query_failed_with_client_connection_error_exception_with_raise_exception(self):
        connector = GremlinConnector("ws://invalid-host:8182/gremlin")
        with pytest.raises(ClientConnectorError) as exec_info:
            connector.execute_query("g.V().limit(1).toList()", raise_exception=True)
        assert isinstance(exec_info.value, ClientConnectorError)
        connector.close()
