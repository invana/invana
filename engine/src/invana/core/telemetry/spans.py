"""
Span helpers that work with or without OpenTelemetry installed.

OpenTelemetry is the optional ``telemetry`` extra, so code outside this package
must import cleanly without it. These helpers give that code one way to open a
span, stamp the current one, add an event or read its context. Without the extra
every helper is a no-op: ``span()`` yields ``None``, the setters do nothing and
``current_span_context()`` returns ``None``.

Usage
-----
    from invana.core.telemetry.spans import add_event, set_current, span

    # Who acted, on the span already open (e.g. the request's SERVER span).
    set_current(**{"enduser.id": user.id, "invana.principal": "user"})

    # A span of your own, a child of whatever is current.
    with span("invana.run", {"invana.run_id": run.id}) as s:
        add_event("run.queued", {"position": 2})
        ...

Attribute values follow OpenTelemetry's rules: ``None`` values are dropped
rather than recorded, so callers can pass optional ids without checking them.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from typing import Any

try:
    from opentelemetry import trace as _trace
    from opentelemetry.trace import Link as _Link
    from opentelemetry.trace import Status as _Status
    from opentelemetry.trace import StatusCode as _StatusCode
except ImportError:  # telemetry extra not installed
    _trace = None
    _Link = None
    _Status = None
    _StatusCode = None

_TRACER_NAME = "invana.engine"


def _clean(attributes: Mapping[str, Any] | None) -> dict[str, Any]:
    return {k: v for k, v in (attributes or {}).items() if v is not None}


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
    if _trace is None:
        yield None
        return
    otel_links = [_Link(ctx) for ctx in links if ctx is not None]
    with _trace.get_tracer(_TRACER_NAME).start_as_current_span(
        name,
        attributes=_clean(attributes),
        links=otel_links,
        record_exception=record_errors,
        set_status_on_exception=record_errors,
    ) as s:
        yield s


def set_current(**attributes: Any) -> None:
    """Set attributes on the current span, if one is recording."""
    if _trace is None:
        return
    current = _trace.get_current_span()
    if current.is_recording():
        current.set_attributes(_clean(attributes))


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
