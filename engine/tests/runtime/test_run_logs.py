"""A run's lifecycle log lines — built from in-memory run rows, no database.

Each ending of a pass writes exactly one line, named for the outcome, and only a
failure carries ``failure_kind``. Inside a real ``invana.run`` span the line
carries that span's trace id.
"""

from __future__ import annotations

import logging

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from invana.core.logging.filters import TraceContextFilter
from invana.core.telemetry import spans
from invana.runtime.interpreter.tracing import crash_logged, log_run_ended, log_run_started, run_span
from invana.runtime.models import TaskRun

LOGGER = "invana.runtime.interpreter.tracing"


def _run(**overrides) -> TaskRun:
    fields = {"id": "run-1", "graph_id": "g-1", "role": "root", "triggered_by": "user", "ask_kind": "nl"}
    return TaskRun(**{**fields, **overrides})


@pytest.fixture
def exporter(monkeypatch) -> InMemorySpanExporter:
    exp = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exp))
    monkeypatch.setattr(spans._trace, "get_tracer", lambda *a, **k: provider.get_tracer("test.invana.run_logs"))
    return exp


def test_a_failed_run_writes_one_error_line_with_its_kind(caplog):
    th = _run(error={"cls": "permanent", "cause": "query_invalid", "message": "Bad query: MATCH secret"})
    with caplog.at_level(logging.DEBUG, logger=LOGGER):
        log_run_ended(th, "error", 1.23456)
    [record] = caplog.records
    assert record.levelno == logging.ERROR
    assert record.getMessage() == "run failed"
    assert record.failure_kind == "permanent·query_invalid"
    assert record.run_duration_s == 1.235
    assert "secret" not in record.getMessage()


def test_a_run_waiting_on_an_answer_is_paused_not_failed(caplog):
    with caplog.at_level(logging.DEBUG, logger=LOGGER):
        log_run_ended(_run(), "clarify", 0.5)
    [record] = caplog.records
    assert record.levelno == logging.INFO
    assert "paused" in record.getMessage()
    assert not hasattr(record, "failure_kind")


def test_a_finished_run_carries_its_trace_and_no_failure(caplog, exporter):
    caplog.handler.addFilter(TraceContextFilter())
    th = _run(ask_kind=None, triggered_by="schedule")
    with caplog.at_level(logging.DEBUG, logger=LOGGER), run_span(th):
        log_run_started(th)
        log_run_ended(th, "ok", 0.1)
    started, finished = caplog.records
    [run] = exporter.get_finished_spans()
    trace_id = format(run.context.trace_id, "032x")
    assert (started.getMessage(), finished.getMessage()) == ("run started", "run finished")
    assert finished.levelno == logging.INFO
    assert (finished.run_kind, finished.run_outcome, finished.run_id) == ("todo", "ok", "run-1")
    assert not hasattr(finished, "failure_kind")
    assert started.trace_id == finished.trace_id == trace_id


def test_a_crash_is_logged_once_with_its_traceback(caplog, exporter):
    with caplog.at_level(logging.DEBUG, logger=LOGGER), pytest.raises(RuntimeError) as raised, run_span(_run()):
        raise RuntimeError("boom")
    # The runtime's crash handler sees it was logged; a crash before the span opened was not.
    assert crash_logged(raised.value) and not crash_logged(RuntimeError("early"))
    [record] = caplog.records
    assert record.levelno == logging.ERROR
    assert record.failure_kind == "defect·internal"
    assert record.exc_info is not None
