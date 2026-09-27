"""
Who acted, from where, on which Graph — the structured fields every log record carries.

A log line inside a request, a run or a background loop should say who it was
for without every call site passing it. This module keeps those fields in a
``ContextVar``; ``TraceContextFilter`` copies them onto each record, and the
formatters render them. The fields are:

``principal``
    ``user`` · ``agent`` · ``system`` · ``external`` · ``anonymous``.
``origin``
    ``studio`` · ``api`` · ``cli`` · ``schedule`` · ``startup`` · ``daemon``.
``graph_id``
    The Graph the work is on.

Nothing outside ``invana.core.telemetry.spans`` normally calls this: the span
helpers bind the same values they record as ``invana.principal``,
``invana.origin`` and ``invana.graph_id``, so a log line and the span it was
written in always agree, with or without the telemetry extra.

Usage
-----
    from invana.core.logging import context

    context.bind(principal="user", origin="studio")    # rest of this task
    with context.fields(graph_id=graph.id):             # this block only
        log.info("…")                                   # carries all three
    with context.fields(fresh=True, principal="system", origin="daemon"):
        ...                                             # nothing inherited

Asyncio copies the context into every task it creates, so a run spawned by a
request starts with the request's fields and replaces the ones it knows better.
A ``None`` value removes a field rather than recording it.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from types import MappingProxyType

FIELDS: tuple[str, ...] = ("principal", "origin", "graph_id")

_EMPTY: Mapping[str, str] = MappingProxyType({})
_current: ContextVar[Mapping[str, str]] = ContextVar("invana_log_fields", default=_EMPTY)


def _merged(base: Mapping[str, str], values: Mapping[str, object | None]) -> Mapping[str, str]:
    out = dict(base)
    for key, value in values.items():
        if key not in FIELDS:
            continue
        if value is None:
            out.pop(key, None)
        else:
            out[key] = str(value)
    return MappingProxyType(out)


def current() -> Mapping[str, str]:
    """The fields bound right now (read-only; empty when none are)."""
    return _current.get()


def bind(**values: object | None) -> None:
    """Set fields for the rest of the current task (and the tasks it goes on to create)."""
    _current.set(_merged(_current.get(), values))


@contextmanager
def fields(*, fresh: bool = False, **values: object | None) -> Iterator[None]:
    """Set fields for the block, restoring the previous ones on exit.

    With ``fresh=True`` the block starts from no fields at all — for work that
    starts its own trace and must not inherit whoever spawned it.
    """
    token = _current.set(_merged(_EMPTY if fresh else _current.get(), values))
    try:
        yield
    finally:
        _current.reset(token)
