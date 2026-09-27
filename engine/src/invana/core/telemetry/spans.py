"""
Span helpers that work with or without OpenTelemetry installed.

OpenTelemetry is the optional ``telemetry`` extra, so code outside this package
must import cleanly without it. These helpers give that code one way to open a
span, stamp the current one, add an event or read its context. Without the extra
every helper is a no-op: ``span()`` yields ``None``, the setters do nothing,
``current_span_context()`` returns ``None`` and ``current_ids()`` two ``None``s.

Usage
-----
    from invana.core.telemetry.spans import add_event, current_ids, set_current, span

    # Who acted, on the span already open (e.g. the request's SERVER span).
    set_current(**{"enduser.id": user.id, "invana.principal": "user"})

    # A span of your own, a child of whatever is current.
    with span("invana.run", {"invana.run_id": run.id}) as s:
        add_event("run.queued", {"position": 2})
        ...

    # Work nobody clicked — a loop iteration, startup, a CLI command — starts
    # its own trace instead of joining whatever happened to be current.
    with root_span("system.graph_health", origin="daemon"):
        ...

    # The ids a record stores so it opens the trace it was written in.
    trace_id, span_id = current_ids()

Attribute values follow OpenTelemetry's rules: ``None`` values are dropped
rather than recorded, so callers can pass optional ids without checking them.

Log fields
----------
Who acted is also what a log line should say. ``span``, ``root_span`` and
``set_current`` bind ``invana.principal``, ``invana.origin`` and
``invana.graph_id`` as the log fields ``principal``, ``origin`` and ``graph_id``
(``invana.core.logging.context``) — for the span's block, or for the rest of the
task with ``set_current``. ``root_span`` starts from no fields, as it starts from
no parent. This happens with or without the extra, so a log line carries who it
was for even when nothing is traced.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from typing import Any

from invana.core.logging import context as _log_context

try:
    from opentelemetry import trace as _trace
    from opentelemetry.context import Context as _Context
    from opentelemetry.trace import Link as _Link
    from opentelemetry.trace import Status as _Status
    from opentelemetry.trace import StatusCode as _StatusCode
except ImportError:  # telemetry extra not installed
    _trace = None
    _Context = None
    _Link = None
    _Status = None
    _StatusCode = None

_TRACER_NAME = "invana.engine"


# Span attribute → log field, for the attributes a log line also carries.
_LOG_FIELDS = {"invana.principal": "principal", "invana.origin": "origin", "invana.graph_id": "graph_id"}


def _clean(attributes: Mapping[str, Any] | None) -> dict[str, Any]:
    return {k: v for k, v in (attributes or {}).items() if v is not None}


def _log_fields(attributes: Mapping[str, Any]) -> dict[str, Any]:
    return {field: attributes[key] for key, field in _LOG_FIELDS.items() if attributes.get(key) is not None}


@contextmanager
def span(
    name: str,
    attributes: Mapping[str, Any] | None = None,
    *,
    links: Sequence[Any] = (),
    record_errors: bool = True,
) -> Iterator[Any]:
    """Open ``name`` as a child of the current span and make it current.

    ``links`` are span contexts (from ``current_span_context()``) this span is
    related to without being their child. With ``record_errors=False`` an
    exception leaving the block is not recorded and does not mark the span an
    error — for callers that treat some exceptions as outcomes and set the
    status themselves.
    """
    attrs = _clean(attributes)
    with _log_context.fields(**_log_fields(attrs)):
        if _trace is None:
            yield None
            return
        otel_links = [_Link(ctx) for ctx in links if ctx is not None]
        with _trace.get_tracer(_TRACER_NAME).start_as_current_span(
            name,
            attributes=attrs,
            links=otel_links,
            record_exception=record_errors,
            set_status_on_exception=record_errors,
        ) as s:
            yield s


@contextmanager
def root_span(
    name: str,
    *,
    origin: str,
    principal: str = "system",
    attributes: Mapping[str, Any] | None = None,
    links: Sequence[Any] = (),
) -> Iterator[Any]:
    """Open ``name`` as the root of a **new trace** and make it current.

    For work no person started in this moment: a background loop's iteration,
    startup, a CLI command. It never becomes a child of whatever span happens to
    be current — a loop spawned during startup would otherwise hang every
    iteration it ever runs off the startup trace. ``origin`` (``startup`` ·
    ``daemon`` · ``schedule`` · ``cli``) and ``principal`` are recorded as
    ``invana.origin`` and ``invana.principal``; ``links`` relate it to the spans
    that caused it (a queue consumer links to its producers). Errors leaving the
    block are recorded and mark the span failed, as with ``span()``.
    """
    attrs = {"invana.origin": origin, "invana.principal": principal, **_clean(attributes)}
    with _log_context.fields(fresh=True, **_log_fields(attrs)):
        if _trace is None:
            yield None
            return
        otel_links = [_Link(ctx) for ctx in links if ctx is not None]
        with _trace.get_tracer(_TRACER_NAME).start_as_current_span(
            name, context=_Context(), attributes=attrs, links=otel_links
        ) as s:
            yield s


def set_current(**attributes: Any) -> None:
    """Set attributes on the current span, if one is recording.

    Principal, origin and Graph id among them are also bound as log fields for
    the rest of the current task, recording or not.
    """
    attrs = _clean(attributes)
    fields = _log_fields(attrs)
    if fields:
        _log_context.bind(**fields)
    if _trace is None:
        return
    current = _trace.get_current_span()
    if current.is_recording():
        current.set_attributes(attrs)


def add_event(name: str, attributes: Mapping[str, Any] | None = None) -> None:
    """Add an event to the current span, if one is recording."""
    if _trace is None:
        return
    current = _trace.get_current_span()
    if current.is_recording():
        current.add_event(name, _clean(attributes))


def mark_error(target: Any, exc: BaseException | None = None) -> None:
    """Mark ``target`` (a span from ``span()``) failed, recording ``exc`` when given."""
    if _trace is None or target is None:
        return
    if exc is not None and isinstance(exc, Exception):
        target.record_exception(exc)
    target.set_status(_Status(_StatusCode.ERROR, type(exc).__name__ if exc else None))


def current_span_context() -> Any:
    """The current span's context, for a later Link — or ``None`` when there is none."""
    if _trace is None:
        return None
    ctx = _trace.get_current_span().get_span_context()
    return ctx if ctx.is_valid else None


def current_ids() -> tuple[str | None, str | None]:
    """The current span's ``(trace_id, span_id)`` as lower-case hex, for a record.

    The ids are 32 and 16 characters — the spelling a trace backend shows, so a
    row's ids can be pasted straight into its search. Both are ``None`` with no
    valid span open, or without the telemetry extra, so a record written outside
    any trace stores nulls rather than zeros.
    """
    ctx = current_span_context()
    if ctx is None:
        return None, None
    return format(ctx.trace_id, "032x"), format(ctx.span_id, "016x")
