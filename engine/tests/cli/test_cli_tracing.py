"""A CLI command run is one root span — with a real SDK tracer, no collector.

``invana.core.telemetry.spans`` is pointed at a local ``TracerProvider`` with an
in-memory exporter, so what is asserted is what an OTLP exporter would have been
handed.
"""

from __future__ import annotations

import pytest
from click.testing import CliRunner
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from invana.cli.main import app
from invana.core.telemetry import spans


@pytest.fixture
def exporter(monkeypatch) -> InMemorySpanExporter:
    exp = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exp))
    monkeypatch.setattr(spans._trace, "get_tracer", lambda *a, **k: provider.get_tracer("test.invana.cli"))
    return exp


def test_command_run_is_one_root_span(exporter):
    result = CliRunner().invoke(app, ["version"])

    assert result.exit_code == 0
    [span] = exporter.get_finished_spans()
    assert span.name == "cli.version"
    assert span.parent is None
    assert span.attributes["invana.origin"] == "cli"
    assert span.attributes["invana.principal"] == "user"
    assert span.attributes["invana.cli.command"] == "version"
    assert span.attributes["invana.outcome"] == "ok"
    assert "enduser.id" not in span.attributes


def test_start_is_not_traced(exporter):
    result = CliRunner().invoke(app, ["start", "--help"])

    assert result.exit_code == 0
    assert [s.name for s in exporter.get_finished_spans() if s.name.startswith("cli.")] == []
