import pytest
from invana.ogm.exceptions import FieldValidationError
from invana.ogm.fields import StringProperty, FloatProperty, LongProperty
from invana.ogm.models import VertexModel
from invana.connector.data_types import FloatType
from invana import InvanaGraph
import os

gremlin_server_url = os.environ.get("GREMLIN_SERVER_URL", "ws://megamind.local:8182/gremlin")
graph = InvanaGraph(gremlin_server_url)

DEFAULT_USERNAME = "rrmerugu"
DEFAULT_POINTS_VALUE = 5


class Star(VertexModel):
    graph = graph

    properties = {
        'name': StringProperty(min_length=3, max_length=30, trim_whitespaces=True),
        'distance_from_earth_float': FloatProperty(default=DEFAULT_POINTS_VALUE, min_value=5,
                                            max_value=1989000000000000 * 100),
    }


class TestFloatField:

    def test_field(self):
        graph.connector.g.V().drop()
        star = Star.objects.create(name="Sun", distance_from_earth_float=FloatType(1989000000000000))
        assert isinstance(star.properties.distance_from_earth_float, FloatType)

    def test_field_max_value(self):
        graph.connector.g.V().drop()
        with pytest.raises(FieldValidationError) as exec_info:
            Star.objects.create(name="Sun", distance_from_earth_float=FloatType(1989000000000000000000000000000 * 10000))
        assert "max_value for field" in exec_info.value.__str__()

    def test_field_min_value(self):
        graph.connector.g.V().drop()
        with pytest.raises(FieldValidationError) as exec_info:
            Star.objects.create(name="Sun", distance_from_earth_float=2)
        assert "min_value for field " in exec_info.value.__str__()

    def test_field_default(self):
        graph.connector.g.V().drop()
        star = Star.objects.create(name="Ravi")
        assert star.properties.distance_from_earth_float == DEFAULT_POINTS_VALUE
