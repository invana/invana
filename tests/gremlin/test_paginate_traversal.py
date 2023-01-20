from invana.gremlin.connector import GremlinConnector
import pytest


class TestPaginateTraversal:

    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_paginate(self,  connectors_store, connector_name):
        connector = connectors_store[connector_name]
        page_size = 5
        result = connector.g.V().search(has__label="TestUser").paginate(page_size, 1).elementMap().toList()
        assert result.__len__() == page_size
        page_size = 3
        result = connector.g.V().search(has__label="TestUser").paginate(page_size, 1).elementMap().toList()
        assert result.__len__() == page_size
