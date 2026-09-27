"""
Metric recorders — the one way code outside ``core/telemetry`` records a metric.

OpenTelemetry is the optional ``telemetry`` extra, so a connector, the LLM
client or the runtime must import cleanly without it. Every function here is a
**no-op when the extra is absent** and never raises, so a metric can never
fail the work it measures. Durations are passed in seconds.

Usage
-----
    from invana.core.telemetry.recorders import record_graph_query

    record_graph_query(
        connector="neo4j", language="cypher", operation="read",
        outcome="ok", duration_s=0.012, result_size=40,
    )

Attributes are bounded (see ``metrics.py``): pass kinds, keys and outcomes —
never a user, run or Graph id. Each recorder names exactly the attributes its
instrument carries, so a call site cannot widen one by accident.

The instruments are read off ``metrics`` at call time, not bound at import, so
a test can point one at a local ``MeterProvider`` with ``monkeypatch.setattr``
and exercise the real recorder against real SDK instruments.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping

try:
    from opentelemetry.metrics import CallbackOptions, Observation

    from invana.core.telemetry import metrics as _m

    _ENABLED = True
except ImportError:  # telemetry extra not installed
    _ENABLED = False

logger = logging.getLogger("invana.telemetry")


def _safe(record: Callable[[], None]) -> None:
    if not _ENABLED:
        return
    try:
        record()
    except Exception:
        logger.debug("A metric could not be recorded", exc_info=True)


# ── Runs ─────────────────────────────────────────────────────────────────────


def add_run_active(delta: int, *, kind: str, role: str, triggered_by: str) -> None:
    """+1 when a run is admitted and starts working, -1 when it settles."""
    _safe(lambda: _m.runs_active.add(delta, {"kind": kind, "role": role, "triggered_by": triggered_by}))


def record_run_admitted(*, kind: str, role: str, triggered_by: str, queue_wait_s: float) -> None:
    """How long a run waited for a slot before it was admitted."""
    labels = {"kind": kind, "role": role, "triggered_by": triggered_by}
    _safe(lambda: _m.runs_queue_wait.record(queue_wait_s, labels))


def record_run(*, kind: str, role: str, triggered_by: str, outcome: str, duration_s: float) -> None:
    """One settled run: its working time and one count, by outcome."""
    labels = {"kind": kind, "role": role, "triggered_by": triggered_by, "outcome": outcome}

    def _record() -> None:
        _m.runs_duration.record(duration_s, labels)
        _m.runs_count.add(1, labels)

    _safe(_record)


def record_run_step(*, step_key: str, outcome: str, duration_s: float) -> None:
    """One attempt of one step."""
    _safe(lambda: _m.runs_step_duration.record(duration_s, {"step_key": step_key, "outcome": outcome}))


# ── LLMs ─────────────────────────────────────────────────────────────────────


def record_llm_request(
    *,
    provider: str,
    model: str,
    role: str,
    outcome: str,
    duration_s: float,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cost_usd: float | None = None,
) -> None:
    """One model provider call: duration and count always; tokens and cost when known.

    ``role`` is what the call was for in the run (the client's operation, e.g.
    planning or answering). Cost is counted only when the call had a price, so
    a free local model adds tokens but no spend.
    """

    def _record() -> None:
        labels = {"provider": provider, "model": model, "role": role, "outcome": outcome}
        _m.llms_request_duration.record(duration_s, labels)
        _m.llms_request_count.add(1, labels)
        base = {"provider": provider, "model": model}
        if input_tokens:
            _m.llms_tokens.add(input_tokens, {**base, "direction": "input"})
        if output_tokens:
            _m.llms_tokens.add(output_tokens, {**base, "direction": "output"})
        if cost_usd:
            _m.llms_cost.add(cost_usd, base)

    _safe(_record)


# ── Graph connectors ─────────────────────────────────────────────────────────


def record_graph_query(
    *,
    connector: str,
    language: str,
    operation: str,
    outcome: str,
    duration_s: float,
    result_size: int | None = None,
) -> None:
    """One graph query round-trip, Cypher or Gremlin; the result size on success."""

    def _record() -> None:
        labels = {"connector": connector, "language": language, "operation": operation, "outcome": outcome}
        _m.graph_query_duration.record(duration_s, labels)
        _m.graph_query_count.add(1, labels)
        if result_size is not None:
            _m.graph_query_result_size.record(result_size, labels)

    _safe(_record)


# ── Streams · events · loops ─────────────────────────────────────────────────


def add_stream(delta: int, *, stream: str) -> None:
    """+1 when a server-sent event stream opens, -1 when it closes (``run`` · ``events``)."""
    _safe(lambda: _m.assistant_streams_active.add(delta, {"stream": stream}))


def record_event(*, action: str) -> None:
    """One audit event written."""
    _safe(lambda: _m.events_emitted.add(1, {"action": action}))


def record_loop(*, loop: str, duration_s: float, failed: bool) -> None:
    """One iteration of a background loop, and a failure count when it failed."""

    def _record() -> None:
        _m.system_loop_duration.record(duration_s, {"loop": loop})
        if failed:
            _m.system_loop_failures.add(1, {"loop": loop})

    _safe(_record)


# ── Graph connection pool ────────────────────────────────────────────────────


def observe_pool(read: Callable[[], Mapping[str, int]]) -> None:
    """Register the pool gauge; ``read`` returns ``{state: count}`` when collected.

    States are ``healthy`` · ``backoff`` · ``down``. Call once, from the pool's
    startup. ``read`` runs on the exporter's thread, so it must only read
    in-memory state — no I/O, no awaiting.
    """

    def _callback(_options: CallbackOptions):
        try:
            return [Observation(n, {"state": state}) for state, n in read().items()]
        except Exception:
            logger.debug("The pool gauge could not be read", exc_info=True)
            return []

    _safe(lambda: _m.meter.create_observable_gauge(_m.POOL_CONNECTIONS, callbacks=[_callback], unit="{connection}"))
