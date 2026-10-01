"""Who asked a graph query, and where a finished one is handed (the-model-page.md MP35 · MP36).

Two things, both below every band that runs a query:

- ``query_caller`` — the context a run sets when it starts. A query that runs
  with no caller is not logged: introspection, counts and the page's own reads
  are the platform's, not anyone's question.
- ``observe`` — the one call the connector makes once a query has answered or
  failed. It hands the query to whatever observer the app registered and never
  raises: the query already answered, and the log is not allowed to change that.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

from invana.core.telemetry.spans import current_span_context

logger = logging.getLogger(__name__)

CallerKind = Literal["agent", "plan", "explorer", "api"]


@dataclass(frozen=True, slots=True)
class QueryCaller:
    graph_id: str
    kind: CallerKind
    caller_id: str | None = None
    task_run_id: str | None = None


@dataclass(slots=True)
class ObservedQuery:
    """A graph query that finished — what the log is written from."""

    caller: QueryCaller
    query: str
    parameters: dict[str, Any]
    language: str
    duration_ms: float
    rows: int
    ok: bool
    #: What the result held — the fallback for what the query touched (MP12).
    node_labels: set[str] = field(default_factory=set)
    edge_labels: set[str] = field(default_factory=set)
    at: datetime = field(default_factory=lambda: datetime.now(UTC))
    #: The producer's span, so the writer's span can link back to the query that caused the row.
    span_context: Any = None


query_caller: ContextVar[QueryCaller | None] = ContextVar("query_caller", default=None)

#: The one registered observer, in a list so registering is not a ``global``.
_observers: list[Callable[[ObservedQuery], None]] = []


def set_query_observer(observer: Callable[[ObservedQuery], None] | None) -> None:
    """Register what a finished query is handed to; ``None`` stops logging."""
    _observers.clear()
    if observer is not None:
        _observers.append(observer)


@contextmanager
def calling_as(caller: QueryCaller | None) -> Iterator[None]:
    """Run the block with ``caller`` as the one asking."""
    token = query_caller.set(caller)
    try:
        yield
    finally:
        query_caller.reset(token)


def observe(build: Callable[[QueryCaller], ObservedQuery]) -> None:
    """Hand a finished query to the observer, if someone asked and someone listens.

    ``build`` is only called when both are true, so a query nobody logs costs a
    context-variable read and nothing else.

    The observer only queues the query; the row is written later, in another
    task and another trace. So ``observe`` stamps the query with the span
    current here — the request or run that asked it — and the writer's span
    links back to it, which is how a log row's write is found from the query
    that caused it. Without the telemetry extra the stamp is ``None``.
    """
    caller = query_caller.get()
    if caller is None or not _observers:
        return
    try:
        observed = build(caller)
        observed.span_context = current_span_context()
        _observers[0](observed)
    except Exception:
        logger.warning("A graph query could not be handed to the log", exc_info=True)
