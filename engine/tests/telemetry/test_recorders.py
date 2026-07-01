"""Metric-recorder tests (RFC-041).

Verifies the ``invana.llm.*``, ``invana.query.graph.*``, and
``invana.session.message.*`` families emit with the right labels and the right
success/failure branching. Uses a real in-memory OTLP metric reader — no mocks,
no graph DB (the recorders are pure metric-emit, so no live infra is needed).

The engine sets a process-global MeterProvider at import (telemetry defaults on),
which can't be overridden — so instead of the global provider, we point the
instruments the recorders read (``invana.telemetry.metrics.*``) at a local
provider backed by an ``InMemoryMetricReader``. The recorders resolve those
instruments by module attribute at call time, so the redirect is transparent and
these still exercise the real recorder code against real SDK instruments.
"""

from __future__ import annotations

import pytest
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader

from invana.telemetry import metrics as _m
from invana.telemetry.recorders import (
    record_graph_query,
    record_llm_request,
    record_session_message,
)


@pytest.fixture
def reader(monkeypatch) -> InMemoryMetricReader:
    r = InMemoryMetricReader()
    meter = MeterProvider(metric_readers=[r]).get_meter("test.invana")
    histos = {
        "llm_request_duration": "invana.llm.request.duration",
        "graph_query_duration": "invana.query.graph.duration",
        "graph_query_result_size": "invana.query.graph.result_size",
        "session_message_duration": "invana.session.message.duration",
    }
    counters = {
        "llm_request_count": "invana.llm.request.count",
        "llm_request_errors": "invana.llm.request.errors",
        "llm_tokens_input": "invana.llm.tokens.input",
        "llm_tokens_output": "invana.llm.tokens.output",
        "graph_query_count": "invana.query.graph.count",
        "graph_query_errors": "invana.query.graph.errors",
        "session_message_count": "invana.session.message.count",
        "session_message_errors": "invana.session.message.errors",
    }
    for attr, name in histos.items():
        monkeypatch.setattr(_m, attr, meter.create_histogram(name))
    for attr, name in counters.items():
        monkeypatch.setattr(_m, attr, meter.create_counter(name))
    return r


def _points(reader: InMemoryMetricReader, name: str) -> list:
    data = reader.get_metrics_data()
    return [
        p
        for rm in data.resource_metrics
        for sm in rm.scope_metrics
        for m in sm.metrics
        if m.name == name
        for p in m.data.data_points
    ]


def _match(points: list, **attrs) -> list:
    return [p for p in points if all(p.attributes.get(k) == v for k, v in attrs.items())]


# ── LLM ───────────────────────────────────────────────────────────────────────


def test_llm_success_records_duration_and_tokens(reader):
    record_llm_request(
        provider="anthropic",
        model_id="claude-opus-4-8",
        operation="translate",
        duration_ms=42.0,
        status="success",
        input_tokens=100,
        output_tokens=25,
    )
    dur = _match(_points(reader, "invana.llm.request.duration"), provider="anthropic", status="success")
    assert dur and dur[0].count == 1 and dur[0].sum > 0
    tin = _match(_points(reader, "invana.llm.tokens.input"), provider="anthropic", operation="translate")
    tout = _match(_points(reader, "invana.llm.tokens.output"), provider="anthropic", operation="translate")
    assert tin[0].value == 100
    assert tout[0].value == 25


def test_llm_failure_records_error_and_no_tokens(reader):
    record_llm_request(
        provider="ollama",
        model_id="qwen3-coder:30b",
        operation="translate",
        duration_ms=5.0,
        status="failed",
        error_type="LLMError",
    )
    errs = _match(_points(reader, "invana.llm.request.errors"), provider="ollama", error_type="LLMError")
    assert errs and errs[0].value == 1
    # A failed call must not book token throughput (tokens are unknown on failure).
    assert not _match(_points(reader, "invana.llm.tokens.input"), provider="ollama")


# ── Graph query (unified Cypher + Gremlin) ────────────────────────────────────


@pytest.mark.parametrize("language", ["cypher", "gremlin"])
def test_graph_query_success_records_by_language(reader, language):
    record_graph_query(
        language=language,
        backend="OpenCypherConnector" if language == "cypher" else "GremlinConnector",
        duration_ms=17.0,
        status="success",
        result_size=8,
    )
    dur = _match(_points(reader, "invana.query.graph.duration"), language=language, status="success")
    assert dur and dur[0].count == 1
    size = _match(_points(reader, "invana.query.graph.result_size"), language=language)
    assert size and size[0].sum == 8


def test_graph_query_failure_records_error_category(reader):
    record_graph_query(
        language="gremlin",
        backend="GremlinConnector",
        duration_ms=3.0,
        status="failed",
        error_type="QueryExecutionError",
        error_category="timeout",
    )
    errs = _match(_points(reader, "invana.query.graph.errors"), language="gremlin", error_category="timeout")
    assert errs and errs[0].value == 1


# ── Session message ───────────────────────────────────────────────────────────


@pytest.mark.parametrize("mode", ["nl", "ql"])
def test_session_message_records_by_mode(reader, mode):
    record_session_message(mode=mode, surface="explorer", duration_ms=120.0, status="ok")
    dur = _match(_points(reader, "invana.session.message.duration"), mode=mode, surface="explorer", status="ok")
    assert dur and dur[0].count == 1 and dur[0].sum > 0


def test_session_message_error_increments_error_counter(reader):
    record_session_message(mode="nl", surface="modeller", duration_ms=90.0, status="error")
    errs = _match(_points(reader, "invana.session.message.errors"), surface="modeller", status="error")
    assert errs and errs[0].value == 1
