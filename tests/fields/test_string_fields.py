import pytest
from invana.ogm.exceptions import FieldValidationError
from invana.ogm.fields import StringProperty, IntegerProperty, DateTimeProperty
from invana.ogm.models import VertexModel
from datetime import datetime
from invana import InvanaGraph
import os

gremlin_server_url = os.environ.get("GREMLIN_SERVER_URL", "ws://megamind.local:8182/gremlin")
graph = InvanaGraph(gremlin_server_url)

DEFAULT_USERNAME = "rrmerugu"


class Person(VertexModel):
    graph = graph

    properties = {
        'first_name': StringProperty(min_length=3, max_length=30, trim_whitespaces=True),
        'last_name': StringProperty(allow_null=True),
        'username': StringProperty(default=DEFAULT_USERNAME),
        'member_since': IntegerProperty(),
        'created_at': DateTimeProperty(default=lambda: datetime.now())

    }


class TestStringField:

    def test_field(self):
        graph.connector.g.V().drop()
        project = Person.objects.create(first_name="Ravi Raja", member_since=2022)
        assert isinstance(project.properties.first_name, str)

    def test_field_max_length(self):
        graph.connector.g.V().drop()
        with pytest.raises(FieldValidationError) as exec_info:
            Person.objects.create(first_name="Ravi Raja 12122312312312321312312312312313231231")
        assert "max_length for field" in exec_info.value.__str__()

    def test_field_min_length(self):
        graph.connector.g.V().drop()
        with pytest.raises(FieldValidationError) as exec_info:
            Person.objects.create(first_name="RR")
        assert "min_length for field " in exec_info.value.__str__()

    def test_field_default(self):
        graph.connector.g.V().drop()
        person = Person.objects.create(first_name="Ravi", member_since=2022)
        assert person.properties.username == DEFAULT_USERNAME
