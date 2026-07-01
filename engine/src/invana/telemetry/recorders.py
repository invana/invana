"""Metric recorders for hot paths whose emit-point can't use ``@capture_metrics``
(RFC-041).

The decorator assumes a bound ``self`` and a fixed 4-instrument shape
(duration/count/errors/in_flight). Three domains don't fit that:

  - **LLM** (``invana.llm.*``) — ``llm.client.complete_tool`` is a module-level
    function, and LLM adds token counters.
  - **Graph query** (``invana.query.graph.*``) — emitted from the connector
    round-trip, unified across Cypher + Gremlin, with a result-size histogram.
  - **Session message** (``invana.session.message.*``) — wraps the whole
    ``send_message`` orchestration.

Every function is a **no-op when the optional ``telemetry`` extra is absent**, so
engine core (connectors, the LLM client) imports cleanly without OpenTelemetry —
mirroring the lazy-tracer pattern in those modules.
"""

from __future__ import annotations

try:
    from invana.telemetry import metrics as _m

    _ENABLED = True
except ImportError:  # telemetry extra not installed
    _ENABLED = False


# ── LLM ───────────────────────────────────────────────────────────────────────


def add_llm_in_flight(delta: int, *, provider: str, model_id: str, operation: str) -> None:
    """Increment (+1) / decrement (-1) the concurrent-LLM-calls gauge."""
    if not _ENABLED:
        return
    _m.llm_requests_in_flight.add(delta, {"provider": provider, "model_id": model_id, "operation": operation})


def record_llm_request(
    *,
    provider: str,
    model_id: str,
    operation: str,
    duration_ms: float,
    status: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    error_type: str | None = None,
) -> None:
    """Record one LLM provider call: duration + count always; tokens on success,
    error counter on failure."""
    if not _ENABLED:
        return
    labels = {"provider": provider, "model_id": model_id, "operation": operation, "status": status}
    if error_type:
        labels["error_type"] = error_type
    _m.llm_request_duration.record(round(duration_ms, 3), labels)
    _m.llm_request_count.add(1, labels)
    if status == "failed":
        _m.llm_request_errors.add(1, labels)
    else:
        token_labels = {"provider": provider, "model_id": model_id, "operation": operation}
        _m.llm_tokens_input.add(input_tokens, token_labels)
        _m.llm_tokens_output.add(output_tokens, token_labels)


# ── Graph query (unified: Cypher + Gremlin) ───────────────────────────────────


def add_graph_query_in_flight(delta: int, *, language: str, backend: str) -> None:
    """Increment (+1) / decrement (-1) the concurrent-graph-queries gauge."""
    if not _ENABLED:
        return
    _m.graph_queries_in_flight.add(delta, {"language": language, "backend": backend})


def record_graph_query(
    *,
    language: str,
    backend: str,
    duration_ms: float,
    status: str,
    result_size: int = 0,
    error_type: str | None = None,
    error_category: str | None = None,
) -> None:
    """Record one graph query round-trip: duration + count always; result_size on
    success, error counter on failure."""
    if not _ENABLED:
        return
    labels: dict[str, str] = {"language": language, "backend": backend, "status": status}
    if error_type:
        labels["error_type"] = error_type
    if error_category:
        labels["error_category"] = error_category
    _m.graph_query_duration.record(round(duration_ms, 3), labels)
    _m.graph_query_count.add(1, labels)
    if status == "failed":
        _m.graph_query_errors.add(1, labels)
    else:
        _m.graph_query_result_size.record(result_size, {"language": language, "backend": backend, "status": status})


# ── Session message ───────────────────────────────────────────────────────────


def add_message_in_flight(delta: int, *, mode: str, surface: str) -> None:
    """Increment (+1) / decrement (-1) the concurrent-messages gauge."""
    if not _ENABLED:
        return
    _m.session_messages_in_flight.add(delta, {"mode": mode, "surface": surface})


def record_session_message(*, mode: str, surface: str, duration_ms: float, status: str) -> None:
    """Record one session message round-trip: duration + count always; error
    counter when ``status == "error"``."""
    if not _ENABLED:
        return
    labels = {"mode": mode, "surface": surface, "status": status}
    _m.session_message_duration.record(round(duration_ms, 3), labels)
    _m.session_message_count.add(1, labels)
    if status == "error":
        _m.session_message_errors.add(1, labels)
