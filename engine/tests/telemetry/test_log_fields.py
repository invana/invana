"""Log fields and redaction: who a line was for, and what it never holds.

A line written inside a span carries the principal, origin and Graph the span
helpers recorded, in JSON and inline in the plain format; a line outside any
carries none. A caller's structured fields pass through the same redaction
rule as events before any handler writes them.
"""

from __future__ import annotations

import json
import logging

from opentelemetry.sdk._logs import LoggerProvider
from pydantic import SecretStr

from invana.core.logging import DEFAULT_LOGGING_CONFIG, RedactFilter, TraceContextFilter
from invana.core.logging.formatters import JSONFormatter, PlainFormatter
from invana.core.telemetry.setup import _otlp_log_handler
from invana.core.telemetry.spans import root_span, set_current

PLAIN_FORMAT = DEFAULT_LOGGING_CONFIG["formatters"]["simple"]["format"]


def _record(extra: dict | None = None) -> logging.LogRecord:
    record = logging.LogRecord("invana.test", logging.INFO, __file__, 1, "hello", None, None)
    record.__dict__.update(extra or {})
    return record


def _write(record: logging.LogRecord) -> tuple[dict, str]:
    """Run the record through the console handler's filters, then both formatters."""
    TraceContextFilter().filter(record)
    RedactFilter().filter(record)
    return json.loads(JSONFormatter().format(record)), PlainFormatter(PLAIN_FORMAT, style="{").format(record)


def test_a_line_in_a_root_span_says_who_and_where():
    """Principal and origin come from the root span; a Graph bound inside it joins them."""
    with root_span("system.graph_health", origin="daemon"):
        set_current(**{"invana.graph_id": "g-1"})
        payload, line = _write(_record())
    assert (payload["principal"], payload["origin"], payload["graph_id"]) == ("system", "daemon", "g-1")
    assert "principal=system origin=daemon graph_id=g-1 : hello" in line


def test_a_line_outside_any_span_has_no_fields():
    """Nothing bound: no field keys in JSON, nothing inline in the plain line."""
    payload, line = _write(_record())
    assert not {"principal", "origin", "graph_id"} & payload.keys()
    assert line.endswith(" : hello") and "principal=" not in line


def test_sensitive_fields_never_reach_a_handler():
    """A credential-named field is dropped, nested ones too, and a secret-typed value is masked."""
    record = _record(
        {
            "api_key": "sk-live",
            "password_hash": "x",
            "run_id": "r-1",
            "provider": {"name": "openai", "refresh_token": "t", "key": SecretStr("k")},
        }
    )
    _write(record)
    assert not hasattr(record, "api_key") and not hasattr(record, "password_hash")
    assert record.run_id == "r-1"
    assert record.provider == {"name": "openai", "key": "**********"}


def test_ordinary_fields_are_left_as_they_are():
    """A field with no credential in its name, at any depth, is untouched."""
    record = _record({"counts": {"nodes": 3, "tokens_used": 9}})
    _write(record)
    assert record.counts == {"nodes": 3, "tokens_used": 9}


def test_a_shipped_line_keeps_its_fields_but_not_the_console_ones():
    """The OTLP handler's filters keep who and where; the console's copy keeps the rest."""
    handler = _otlp_log_handler(LoggerProvider())
    record = _record({"run_id": "r-1"})
    with root_span("system.graph_health", origin="daemon"):
        shipped = handler.filter(record)
    assert (shipped.principal, shipped.origin, shipped.run_id) == ("system", "daemon", "r-1")
    assert not {"trace", "log_fields", "trace_id", "span_id"} & shipped.__dict__.keys()
    assert hasattr(record, "trace") and record.log_fields  # the record other handlers see is unchanged
