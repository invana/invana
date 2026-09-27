"""Log-line tests: trace ids on console and JSON lines, and token redaction in the access log.

Spans come from a local SDK ``TracerProvider`` (not the process-global one), so
the tests do not depend on whether telemetry is switched on for the process.
"""

from __future__ import annotations

import json
import logging

import pytest
from opentelemetry.sdk.trace import TracerProvider

from invana.core.logging import DEFAULT_LOGGING_CONFIG, RedactTokenFilter, TraceContextFilter
from invana.core.logging.formatters import JSONFormatter, PlainFormatter

PLAIN_FORMAT = DEFAULT_LOGGING_CONFIG["formatters"]["simple"]["format"]


def _record(msg: str = "hello", name: str = "invana.test", args=None) -> logging.LogRecord:
    return logging.LogRecord(name, logging.INFO, __file__, 1, msg, args, None)


def _format_both(record: logging.LogRecord) -> tuple[dict, str]:
    TraceContextFilter().filter(record)
    return json.loads(JSONFormatter().format(record)), PlainFormatter(PLAIN_FORMAT, style="{").format(record)


@pytest.fixture
def tracer():
    return TracerProvider().get_tracer("test_logging")


def test_lines_inside_a_span_carry_its_ids(tracer):
    """A line logged inside a span names that span's trace and span ids."""
    with tracer.start_as_current_span("work") as span:
        ctx = span.get_span_context()
        payload, line = _format_both(_record())
    trace_id, span_id = format(ctx.trace_id, "032x"), format(ctx.span_id, "016x")
    assert payload["trace_id"] == trace_id
    assert payload["span_id"] == span_id
    assert f"[{trace_id} {span_id}]" in line


def test_lines_outside_a_span_carry_no_ids():
    """Outside any span the JSON has no trace keys and the plain line no bracket."""
    payload, line = _format_both(_record())
    assert "trace_id" not in payload and "span_id" not in payload
    assert "[" not in line and line.endswith(" : hello")


def test_plain_formatter_works_without_the_filter(tracer):
    """A handler that lacks the trace filter still formats, and still shows the trace."""
    with tracer.start_as_current_span("work") as span:
        line = PlainFormatter(PLAIN_FORMAT, style="{").format(_record())
    assert format(span.get_span_context().trace_id, "032x") in line


def test_access_log_token_is_redacted():
    """The token query parameter is dropped from the access-log path; other params stay."""
    record = _record(
        '%s - "%s %s HTTP/%s" %d',
        name="uvicorn.access",
        args=("1.2.3.4:5", "GET", "/api/v1/runs/1/stream?after=3&token=secret", "1.1", 200),
    )
    assert RedactTokenFilter().filter(record) is True
    message = record.getMessage()
    assert "secret" not in message and "token" not in message
    assert "/api/v1/runs/1/stream?after=3 " in message
