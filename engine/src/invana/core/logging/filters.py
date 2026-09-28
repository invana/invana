"""Custom log filters for Invana."""

from __future__ import annotations

import copy
import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from invana.core.logging import context as _log_context
from invana.core.redaction import is_sensitive, redact

try:  # OpenTelemetry is an optional extra; without it no record carries trace ids.
    from opentelemetry import trace as _otel_trace
except ImportError:  # pragma: no cover - exercised only without the telemetry extra
    _otel_trace = None

# Loggers whose output we suppress from the console.
# These still propagate to root so the OTel OTLP handler can ship them
# to the telemetry backend for analysis.
_CONSOLE_SUPPRESS = frozenset(
    {
        "neo4j",
        "gremlin_python",
        "gremlinpython",
        "asyncio",
        "httpcore",
        "httpx",
    }
)


class SuppressNoisyFilter(logging.Filter):
    """
    Suppresses noisy third-party logger output from the console handler.

    Records from suppressed loggers are NOT dropped from the logging pipeline —
    they still propagate to root and are picked up by the OTel OTLP handler
    (when telemetry is enabled) so they can be analysed in the backend.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        for suppressed in _CONSOLE_SUPPRESS:
            if record.name == suppressed or record.name.startswith(suppressed + "."):
                return False
        return True


class OtlpThirdPartyFilter(logging.Filter):
    """
    Applied to the OTLP log handler.

    - invana.* loggers: ship everything (DEBUG and above).
    - All other loggers: ship WARNING and above only (covers WARNING, ERROR, CRITICAL).

    This keeps the OTel backend useful for debugging invana internals while
    avoiding a flood of third-party driver protocol messages.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name == "invana" or record.name.startswith("invana."):
            return True
        return record.levelno >= logging.WARNING


def current_trace_ids() -> tuple[str, str]:
    """
    Return ``(trace_id, span_id)`` of the span that is active right now.

    The ids are lower-case hex, 32 and 16 characters long — the same spelling a
    trace backend shows, so a log line can be pasted straight into its search.
    Both are empty strings when no valid span is active, or when OpenTelemetry
    is not installed at all.
    """
    if _otel_trace is None:
        return "", ""
    ctx = _otel_trace.get_current_span().get_span_context()
    if not ctx.is_valid:
        return "", ""
    return format(ctx.trace_id, "032x"), format(ctx.span_id, "016x")


def trace_suffix(trace_id: str, span_id: str) -> str:
    """Render the ids for the plain console format: `` [<trace_id> <span_id>]`` or ``""``."""
    return f" [{trace_id} {span_id}]" if trace_id else ""


def fields_suffix(record: logging.LogRecord) -> str:
    """Render the record's context fields inline: `` principal=user origin=studio`` or ``""``."""
    parts = [f"{name}={getattr(record, name)}" for name in _log_context.FIELDS if getattr(record, name, None)]
    return " " + " ".join(parts) if parts else ""


class TraceContextFilter(logging.Filter):
    """
    Stamps every record with the trace it was logged under, and who it was for.

    Sets these attributes on the record:

    - ``trace_id`` / ``span_id`` — lower-hex ids of the active span, or ``""``.
    - ``trace`` — `` [<trace_id> <span_id>]`` or ``""``, ready to drop into a
      ``{}``-style format string such as ``"{levelname} - {asctime}{trace} : {message}"``.
    - ``principal`` · ``origin`` · ``graph_id`` — the fields bound in
      ``invana.core.logging.context`` right now, each only when bound.
    - ``log_fields`` — those fields rendered inline (`` principal=user origin=studio``)
      or ``""``, for the plain format string.

    The ids and fields are read when the record is created on the logging thread,
    so a line written inside a request carries that request's trace and caller
    and can be joined to it in the trace backend. Attributes already on the record
    (set by another filter or passed through ``extra=``) are left untouched. The
    filter never drops a record.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "trace_id") or not hasattr(record, "span_id"):
            trace_id, span_id = current_trace_ids()
            if not hasattr(record, "trace_id"):
                record.trace_id = trace_id
            if not hasattr(record, "span_id"):
                record.span_id = span_id
        if not hasattr(record, "trace"):
            record.trace = trace_suffix(record.trace_id, record.span_id)
        for name, value in _log_context.current().items():
            if not hasattr(record, name):
                setattr(record, name, value)
        if not hasattr(record, "log_fields"):
            record.log_fields = fields_suffix(record)
        return True


# Attributes every LogRecord has, plus those the filters above add — not a caller's fields.
_RECORD_ATTRS = frozenset(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {
    "message",
    "asctime",
    "trace",
    "trace_id",
    "span_id",
    "log_fields",
    "taskName",
}


class OtlpDisplayFieldsFilter(logging.Filter):
    """
    Keeps the console-only attributes off the records the OTLP handler ships.

    ``TraceContextFilter`` adds ``trace`` and ``log_fields`` for the plain
    format string, and ``trace_id`` / ``span_id`` for it and the JSON formatter.
    The OpenTelemetry SDK turns every non-standard record attribute into a log
    attribute, so without this filter each shipped line would repeat its trace
    ids — which the SDK already sets from the active span — and a pre-rendered
    copy of its fields. ``principal`` · ``origin`` · ``graph_id`` and a caller's
    own fields are kept.

    Attach it last on the OTLP handler. It returns a copy of the record rather
    than editing it, because the same record object is passed to every handler
    and the console handler still needs those attributes. The filter never
    drops a record.
    """

    FIELDS = ("trace", "log_fields", "trace_id", "span_id")

    def filter(self, record: logging.LogRecord) -> logging.LogRecord:
        shipped = copy.copy(record)
        for name in self.FIELDS:
            shipped.__dict__.pop(name, None)
        return shipped


class RedactFilter(logging.Filter):
    """
    Keeps credentials out of every log handler, by the same rule as events.

    A caller's structured fields — anything passed through ``extra=`` — are
    checked by name: a sensitive one (``password``, ``api_key``, ``secret``,
    ``token``, ``*_hash``, ``*_encrypted``) is removed from the record, and every
    other value has sensitive keys dropped at any depth and secret-typed values
    masked (``invana.core.redaction``). Mapping or container ``args`` are redacted
    the same way before the message is formatted. The message text itself is not
    parsed: code never formats a secret into it.

    Attach it to each handler (the console handler in ``DEFAULT_LOGGING_CONFIG``,
    the OTLP handler in telemetry setup) — a filter on a logger does not see the
    records its children propagate. The filter never drops a record.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        for key in [k for k in record.__dict__ if k not in _RECORD_ATTRS]:
            if is_sensitive(key):
                delattr(record, key)
            else:
                record.__dict__[key] = redact(record.__dict__[key])
        if isinstance(record.args, (dict, tuple)) and record.args:
            record.args = redact(record.args)
        return True


class RedactTokenFilter(logging.Filter):
    """
    Removes the ``token`` query parameter from uvicorn's access-log lines.

    Browsers cannot set headers on an ``EventSource``, so Studio's live streams
    carry the access token in the URL (``…/stream?token=<jwt>``). Uvicorn logs
    every request path verbatim, which would write a working credential into the
    console and every log sink. Attach this filter to the ``uvicorn.access``
    logger; it rewrites the path argument without ``token`` and keeps every other
    parameter in its original order.

    Uvicorn access records carry ``args = (client_addr, method, full_path,
    http_version, status_code)``. Records of any other shape pass through
    unchanged, and the filter never drops a record.
    """

    PARAM = "token"

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str):
            redacted = self.redact(args[2])
            if redacted is not args[2]:
                record.args = (*args[:2], redacted, *args[3:])
        return True

    @classmethod
    def redact(cls, path: str) -> str:
        """Return ``path`` without the ``token`` query parameter (the same object if it had none)."""
        if "?" not in path:
            return path
        parts = urlsplit(path)
        params = parse_qsl(parts.query, keep_blank_values=True)
        kept = [(k, v) for k, v in params if k != cls.PARAM]
        if len(kept) == len(params):
            return path
        return urlunsplit(parts._replace(query=urlencode(kept)))
