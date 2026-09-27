"""Custom log formatters for Invana."""

from __future__ import annotations

import json
import logging
from datetime import datetime

from .filters import current_trace_ids, trace_suffix


def _record_trace_ids(record: logging.LogRecord) -> tuple[str, str]:
    """Trace ids stamped on the record by ``TraceContextFilter``, else the active span's."""
    trace_id = getattr(record, "trace_id", None)
    span_id = getattr(record, "span_id", None)
    if trace_id is None or span_id is None:
        return current_trace_ids()
    return trace_id, span_id


class PlainFormatter(logging.Formatter):
    """
    The console formatter: a ``{}``-style format string that may use ``{trace}``.

    ``TraceContextFilter`` normally sets ``record.trace``. A handler configured
    without that filter (for example in a user-supplied logging config that reuses
    this formatter) would otherwise fail on the missing field, so the formatter
    fills ``trace`` itself from the active span when the record lacks it.
    """

    def format(self, record: logging.LogRecord) -> str:
        if not hasattr(record, "trace"):
            record.trace = trace_suffix(*_record_trace_ids(record))
        return super().format(record)


class JSONFormatter(logging.Formatter):
    """
    Formats log records as single-line JSON objects.

    When the record was logged inside an active span, ``trace_id`` and ``span_id``
    (lower-hex) are added so a log line can be joined to its trace; outside any
    span the two keys are left out.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_data: dict = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }
        trace_id, span_id = _record_trace_ids(record)
        if trace_id:
            log_data["trace_id"] = trace_id
            log_data["span_id"] = span_id
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info),
            }
        return json.dumps(log_data, default=str, ensure_ascii=False)
