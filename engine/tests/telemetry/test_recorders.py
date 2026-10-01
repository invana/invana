"""Metric-recorder tests: the ``invana.llms.*`` and ``invana.graph_connectors.query.*``
families record with bounded attributes and branch correctly on the outcome.

Uses a real in-memory metric reader — no mocks, no graph DB (the recorders only
emit metrics, so no live infrastructure is needed).

The engine may set a process-global MeterProvider at import, which cannot be
overridden — so instead of the global provider, the instruments the recorders
read (``invana.core.telemetry.metrics.*``) are pointed at a local provider backed
by an ``InMemoryMetricReader``. The recorders resolve those instruments by module
attribute at call time, so the redirect is transparent and these still exercise
the real recorder code against real SDK instruments.
"""

from __future__ import annotations

import pytest
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader

from invana.core.telemetry import metrics as _m
from invana.core.telemetry.recorders import record_graph_query, record_llm_request

# Every attribute key these families may carry; anything else would be unbounded.
_BOUNDED_KEYS = {"provider", "model", "role", "outcome", "direction", "connector", "language", "operation"}


@pytest.fixture
def reader(monkeypatch) -> InMemoryMetricReader:
    r = InMemoryMetricReader()
    meter = MeterProvider(metric_readers=[r]).get_meter("test.invana")
    histograms = {
        "llms_request_duration": "invana.llms.request.duration",
        "graph_query_duration": "invana.graph_connectors.query.duration",
        "graph_query_result_size": "invana.graph_connectors.query.result_size",
    }
    counters = {
        "llms_request_count": "invana.llms.request.count",
        "llms_tokens": "invana.llms.tokens",
        "llms_cost": "invana.llms.cost",
        "graph_query_count": "invana.graph_connectors.query.count",
    }
    for attr, name in histograms.items():
        monkeypatch.setattr(_m, attr, meter.create_histogram(name))
    for attr, name in counters.items():
        monkeypatch.setattr(_m, attr, meter.create_counter(name))
    return r


def _all_points(reader: InMemoryMetricReader) -> dict[str, list]:
    return {
        m.name: list(m.data.data_points)
        for rm in reader.get_metrics_data().resource_metrics
        for sm in rm.scope_metrics
        for m in sm.metrics
    }


def test_llm_call_records_duration_count_and_tokens_by_direction(reader):
    record_llm_request(
        provider="anthropic",
        model="claude-haiku-4-5",
        role="translate",
        outcome="ok",
        duration_s=0.42,
        input_tokens=100,
        output_tokens=25,
        cost_usd=0.000225,
    )
    points = _all_points(reader)
    labels = {"provider": "anthropic", "model": "claude-haiku-4-5", "role": "translate", "outcome": "ok"}
    (duration,) = points["invana.llms.request.duration"]
    assert dict(duration.attributes) == labels
    assert duration.count == 1 and duration.sum == pytest.approx(0.42)
    (count,) = points["invana.llms.request.count"]
    assert count.value == 1
    tokens = {p.attributes["direction"]: p.value for p in points["invana.llms.tokens"]}
    assert tokens == {"input": 100, "output": 25}
    (cost,) = points["invana.llms.cost"]
    assert cost.value == pytest.approx(0.000225)


def test_graph_query_records_with_result_size(reader):
    record_graph_query(
        connector="Neo4jConnector",
        language="cypher",
        operation="query",
        outcome="ok",
        duration_s=0.017,
        result_size=8,
    )
    points = _all_points(reader)
    labels = {"connector": "Neo4jConnector", "language": "cypher", "operation": "query", "outcome": "ok"}
    (duration,) = points["invana.graph_connectors.query.duration"]
    assert dict(duration.attributes) == labels and duration.count == 1
    (size,) = points["invana.graph_connectors.query.result_size"]
    assert size.sum == 8


def test_failed_graph_query_records_no_result_size(reader):
    record_graph_query(
        connector="JanusGraphConnector",
        language="gremlin",
        operation="query",
        outcome="failed",
        duration_s=0.003,
    )
    points = _all_points(reader)
    (count,) = points["invana.graph_connectors.query.count"]
    assert count.attributes["outcome"] == "failed" and count.value == 1
    assert "invana.graph_connectors.query.result_size" not in points


def test_no_attribute_is_an_id(reader):
    record_llm_request(provider="ollama", model="qwen3", role="plan", outcome="failed", duration_s=0.1, input_tokens=5)
    record_graph_query(
        connector="MemgraphConnector", language="cypher", operation="query", outcome="ok", duration_s=0.1
    )
    keys = {k for pts in _all_points(reader).values() for p in pts for k in p.attributes}
    assert keys and keys <= _BOUNDED_KEYS
