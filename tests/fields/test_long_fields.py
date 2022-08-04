import pytest
from invana.ogm.exceptions import FieldValidationError
from invana.ogm.fields import StringProperty, LongProperty
from invana.ogm.models import NodeModel
from gremlin_python.statics import long
from invana.connector.data_types import LongType
from invana import settings, graph
import os

settings.GREMLIN_URL = os.environ.get("GREMLIN_SERVER_URL", "ws://megamind-ws:8182/gremlin")

DEFAULT_USERNAME = "rrmerugu"
DEFAULT_POINTS_VALUE = long(5)


class Star(NodeModel):
    name = StringProperty(min_length=3, max_length=30, trim_whitespaces=True)
    distance_from_earth_long = LongProperty(default=DEFAULT_POINTS_VALUE, min_value=5,
                                            max_value=5000000000)


class TestLongField:

    def test_field(self):
        graph.g.V().drop()
        star = Star.objects.create(name="Sun", distance_from_earth_long=LongType(1213123131))
        assert isinstance(star.properties.distance_from_earth_long, LongType)

    def test_field_max_value(self):
        graph.g.V().drop()
        with pytest.raises(FieldValidationError) as exec_info:
            Star.objects.create(name="Sun",
                                distance_from_earth_long=LongType(12312312312))
        assert "max_value for field" in exec_info.value.__str__()

    def test_field_min_value(self):
        graph.g.V().drop()
        with pytest.raises(FieldValidationError) as exec_info:
            Star.objects.create(name="Sun", distance_from_earth_long=LongType(2))
        assert "min_value for field " in exec_info.value.__str__()

    def test_field_default(self):
        graph.g.V().drop()
        star = Star.objects.create(name="Ravi")
        assert star.properties.distance_from_earth_long == DEFAULT_POINTS_VALUE
