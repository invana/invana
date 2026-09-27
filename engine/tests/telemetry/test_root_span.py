"""Work nobody clicked starts its own trace.

``root_span`` against a real SDK ``TracerProvider`` with an in-memory exporter:
opened while another span is current, it is still a root of a new trace, and it
says where it came from and who acted.
"""

from __future__ import annotations

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from invana.core.telemetry import spans


@pytest.fixture
def exporter(monkeypatch) -> InMemorySpanExporter:
    exp = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exp))
    monkeypatch.setattr(spans._trace, "get_tracer", lambda *a, **k: provider.get_tracer("test"))
    return exp


def test_a_root_span_starts_a_new_trace_even_inside_another(exporter):
    with spans.span("system.startup") as startup:
        with spans.root_span("system.graph_health", origin="daemon", attributes={"invana.graph.connections": 2}):
            pass
        with spans.span("child"):
            pass

    finished = {s.name: s for s in exporter.get_finished_spans()}
    sweep = finished["system.graph_health"]
    assert sweep.parent is None
    assert sweep.context.trace_id != startup.get_span_context().trace_id
    assert sweep.attributes["invana.origin"] == "daemon"
    assert sweep.attributes["invana.principal"] == "system"
    assert sweep.attributes["invana.graph.connections"] == 2
    # A plain span still joins the trace it was opened in.
    assert finished["child"].parent.span_id == startup.get_span_context().span_id


def test_a_failure_inside_a_root_span_marks_it_failed(exporter):
    with pytest.raises(ConnectionError), spans.root_span("system.events_listen", origin="daemon"):
        raise ConnectionError("refused")

    (listen,) = exporter.get_finished_spans()
    assert listen.status.status_code.name == "ERROR"
    assert listen.events[0].name == "exception"
