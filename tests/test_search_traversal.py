from invana_py.connector.connector import GremlinConnector


class TestSearchTraversal:

    def test_simple_search(self, connection: GremlinConnector):
        result = connection.g.V().search(has__name="invana engine").elementMap().toList()
        assert result[0].properties.name == "invana engine"

    def test_has_name_search(self, connection: GremlinConnector):
        result = connection.g.V().search(has__name__startingWith="invana").elementMap().toList()
        assert result.__len__() == 3

    def test_has_label_within(self, connection: GremlinConnector):
        result = connection.g.V().search(has__label__within=["User", "Project"]).elementMap().toList()
        assert result.__len__() == 3

    def test_advanced_search(self, connection: GremlinConnector):
        result = connection.g.V().search(has__label="Project",
                                         has__name__startingWith="invana"
                                         ).elementMap().toList()
        assert result.__len__() == 2
