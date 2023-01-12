from invana.gremlin.connector import GremlinConnector


class TestPaginateTraversal:

    def test_paginate(self, connector: GremlinConnector):
        page_size = 5
        result = connector.g.V().search(has__label="TestUser").paginate(page_size, 1).elementMap().toList()
        assert result.__len__() == page_size
        page_size = 3
        result = connector.g.V().search(has__label="TestUser").paginate(page_size, 1).elementMap().toList()
        assert result.__len__() == page_size
