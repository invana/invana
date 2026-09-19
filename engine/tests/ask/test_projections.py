"""Projections — a template plus values, checked before it renders.

The rules under test are the ones that keep a projection honest
(docs/for-developers/modules/ask/features/projections.md): `accepts` is checked
before render (P4), a template that cannot render is offered **with its reason**
rather than hidden (P10), and falling back to a default is explicit (C9).
"""

from dataclasses import dataclass

from invana.runtime.projections import (
    BUILTIN_RESULT_TEMPLATES,
    accepts_reason,
    render,
    select_template,
    shape_of,
)


@dataclass
class FakeTemplate:
    """A stand-in for the row — `accepts_reason` reads two fields and no more."""

    id: str
    name: str
    surface: str
    accepts: dict
    spec: dict
    intent: str = ""
    version: int = 1


def builtin(name: str) -> FakeTemplate:
    b = next(t for t in BUILTIN_RESULT_TEMPLATES if t.name == name)
    return FakeTemplate(
        id=name, name=b.name, surface=b.surface, accepts=dict(b.accepts), spec=dict(b.spec), intent=b.intent
    )


@dataclass
class FakeResult:
    result_type: str
    row_count: int
    rows: list | None = None
    data: object | None = None
    query_language: str = "cypher"
    execution_time_ms: int = 4


class TestShape:
    def test_one_row_one_column_is_a_single_value(self):
        shape = shape_of(FakeResult(result_type="tabular", row_count=1, rows=[{"total": 42}]))
        assert shape.is_single_value is True
        assert shape.numeric_columns == ("total",)

    def test_a_label_and_a_number_over_rows_is_categorical(self):
        shape = shape_of(
            FakeResult(
                result_type="tabular",
                row_count=3,
                rows=[{"sector": "energy", "n": 4}, {"sector": "banks", "n": 9}, {"sector": "it", "n": 2}],
            )
        )
        assert shape.is_categorical is True

    def test_zero_rows_is_empty(self):
        assert shape_of(FakeResult(result_type="tabular", row_count=0, rows=[])).is_empty is True


class TestAccepts:
    def test_a_chart_refuses_a_single_value_and_says_why(self):
        shape = shape_of(FakeResult(result_type="tabular", row_count=1, rows=[{"total": 42}]))
        reason = accepts_reason(builtin("category-bars"), shape)

        assert reason is not None
        assert "numeric column" in reason

    def test_a_table_accepts_rows(self):
        shape = shape_of(FakeResult(result_type="tabular", row_count=2, rows=[{"a": 1}, {"a": 2}]))
        assert accepts_reason(builtin("records-table"), shape) is None

    def test_nothing_renders_records_that_are_not_there(self):
        shape = shape_of(FakeResult(result_type="tabular", row_count=0, rows=[]))
        assert accepts_reason(builtin("records-table"), shape) == "there are no records to render"


class TestSelection:
    def test_the_most_specific_template_wins(self):
        shape = shape_of(FakeResult(result_type="tabular", row_count=1, rows=[{"total": 42}]))
        chosen, offers = select_template(
            [builtin("records-table"), builtin("single-value"), builtin("category-bars")], shape
        )

        assert chosen.name == "single-value"
        # Every other template is still offered — disabled, with its reason (P10).
        unavailable = [o for o in offers if not o["available"]]
        assert [o["name"] for o in unavailable] == ["category-bars"]
        assert all(o["reason"] for o in unavailable)

    def test_no_eligible_template_falls_back_explicitly(self):
        shape = shape_of(FakeResult(result_type="tabular", row_count=0, rows=[]))
        chosen, offers = select_template([builtin("records-table")], shape)

        assert chosen is None
        # The caller records that no template chose the rendering (AS9).
        kind, payload = render(None, FakeResult(result_type="tabular", row_count=0, rows=[]), shape)
        assert kind == "empty"
        assert "does not hold" in payload["statement"]
        assert offers[0]["available"] is False


class TestRender:
    def test_a_single_value_renders_as_a_metric(self):
        result = FakeResult(result_type="tabular", row_count=1, rows=[{"total": 42}])
        shape = shape_of(result)
        kind, payload = render(builtin("single-value"), result, shape)

        assert kind == "metric"
        assert payload == {"value": "42", "label": "total"}

    def test_categories_render_as_a_series(self):
        result = FakeResult(
            result_type="tabular",
            row_count=2,
            rows=[{"sector": "energy", "n": 4}, {"sector": "banks", "n": 9}],
        )
        kind, payload = render(builtin("category-bars"), result, shape_of(result))

        assert kind == "chart"
        assert payload["series"] == [
            {"label": "energy", "value": 4.0},
            {"label": "banks", "value": 9.0},
        ]

    def test_the_default_for_rows_is_a_table(self):
        result = FakeResult(result_type="tabular", row_count=2, rows=[{"a": 1}, {"a": 2}])
        kind, _ = render(None, result, shape_of(result))
        assert kind == "table"
