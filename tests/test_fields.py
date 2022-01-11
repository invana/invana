import pytest
from aiohttp import ClientConnectorError
from gremlin_python.driver.protocol import GremlinServerError
from invana_py.connector.connector import GremlinConnector
from invana_py.ogm.exceptions import FieldValidationError
from invana_py.ogm.fields import StringProperty, IntegerProperty, FloatProperty, BooleanProperty, DateTimeProperty, \
    DoubleProperty
from invana_py.ogm.models import VertexModel, EdgeModel
from datetime import datetime
from invana_py import InvanaGraph

gremlin_url = "ws://megamind-ws:8182/gremlin"
graph = InvanaGraph(gremlin_url)

DEFAULT_USERNAME = "rrmerugu"


class Project(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=30, min_length=3, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


class Person(VertexModel):
    graph = graph

    properties = {
        'first_name': StringProperty(min_length=2, trim_whitespaces=True),
        'last_name': StringProperty(allow_null=True),
        'username': StringProperty(default=DEFAULT_USERNAME),
        'member_since': IntegerProperty(),

    }


class Organisation(VertexModel):
    graph = graph

    properties = {
        'name': StringProperty(min_length=3, trim_whitespaces=True),
    }


class Authored(EdgeModel):
    graph = graph

    properties = {
        'name': StringProperty(min_length=3, trim_whitespaces=True),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


class TestFields:

    def test_string_field(self, connection: GremlinConnector):
        graph.g.V().drop()
        project = Project.objects.create(name="Ravi Raja")
        assert isinstance(project.properties.name, str)

    def test_string_field_max_length(self, connection: GremlinConnector):
        graph.g.V().drop()
        with pytest.raises(FieldValidationError) as exec_info:
            Project.objects.create(name="Ravi Raja 12122312312312321312312312312313231231")
        assert "max_length for field" in exec_info.value.__str__()

    def test_string_field_min_length(self, connection: GremlinConnector):
        graph.g.V().drop()
        with pytest.raises(FieldValidationError) as exec_info:
            Project.objects.create(name="RR")
        assert "min_length for field " in exec_info.value.__str__()

    def test_string_field_default(self, connection: GremlinConnector):
        graph.g.V().drop()
        person = Person.objects.create(first_name="Ravi", member_since=2022)
        assert person.properties.username == DEFAULT_USERNAME
