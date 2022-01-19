import pytest
from invana_py.ogm.exceptions import FieldValidationError
from invana_py.ogm.fields import StringProperty, ShortProperty
from invana_py.ogm.models import VertexModel
from invana_py import InvanaGraph
from invana_py.connector.data_types import ShortType

gremlin_url = "ws://megamind-ws:8182/gremlin"
graph = InvanaGraph(gremlin_url)

DEFAULT_USERNAME = "rrmerugu"
DEFAULT_POINTS_VALUE = ShortType(5)


class Star(VertexModel):
    graph = graph

    properties = {
        'name': StringProperty(min_length=3, max_length=30, trim_whitespaces=True),
        'age_short': ShortProperty(default=DEFAULT_POINTS_VALUE, min_value=5,
                                   max_value=32767),
    }


class TestShortField:

    def test_field(self):
        graph.g.V().drop()
        star = Star.objects.create(name="Sun", age_short=ShortType(11212))
        assert isinstance(star.properties.age_short, ShortType)

    def test_field_max_value(self):
        graph.g.V().drop()
        with pytest.raises(FieldValidationError) as exec_info:
            Star.objects.create(name="Sun", age_short=122222)
        assert "max_value for field" in exec_info.value.__str__()

    def test_field_min_value(self):
        graph.g.V().drop()
        with pytest.raises(FieldValidationError) as exec_info:
            Star.objects.create(name="Sun", age_short=ShortType(1))
        assert "min_value for field " in exec_info.value.__str__()

    def test_field_default(self):
        graph.g.V().drop()
        star = Star.objects.create(name="Ravi")
        assert star.properties.age_short == DEFAULT_POINTS_VALUE
