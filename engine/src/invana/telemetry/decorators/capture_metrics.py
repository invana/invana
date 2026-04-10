"""
@capture_metrics — records domain-specific OTel metrics for any async/sync method.

Each call records:
  - duration histogram   (ms, labelled by operation / resource / backend / status)
  - operation count      (counter)
  - error count          (counter, on exception)
  - in-flight gauge      (up-down counter: +1 before / -1 in finally)

Supported domains
-----------------
  gremlin     → invana.query.gremlin.*
  ontology    → invana.ontology.operation.*
  postgres    → invana.query.postgres.*
  method      → invana.method.*

Usage
-----
    from invana.telemetry.decorators.capture_metrics import capture_metrics

    # Standalone
    @capture_metrics(domain="ontology", operation="create", resource="domain")
    async def create(self, **data): ...

    # Stacked with @track (track on the outside so it is the parent span)
    @track()
    @capture_metrics(domain="ontology", operation="create", resource="domain", backend="postgres")
    async def create(self, **data): ...
"""

from __future__ import annotations

import asyncio
import functools
import time
from collections.abc import Callable
from typing import Literal

MetricDomain = Literal["gremlin", "ontology", "postgres", "method"]


def _get_domain_instruments(domain: MetricDomain) -> dict:
    """Return the metric instruments for the given domain (lazy import avoids circulars)."""
    from invana.telemetry.metrics import (
        gremlin_error_count,
        gremlin_queries_in_flight,
        gremlin_query_count,
        gremlin_query_duration,
        method_calls_in_flight,
        method_duration,
        method_error_count,
        ontology_error_count,
        ontology_operation_count,
        ontology_operation_duration,
        ontology_operations_in_flight,
        postgres_error_count,
        postgres_queries_in_flight,
        postgres_query_count,
        postgres_query_duration,
    )

    mapping: dict[str, dict] = {
        "gremlin": {
            "duration": gremlin_query_duration,
            "count": gremlin_query_count,
            "errors": gremlin_error_count,
            "in_flight": gremlin_queries_in_flight,
        },
        "ontology": {
            "duration": ontology_operation_duration,
            "count": ontology_operation_count,
            "errors": ontology_error_count,
            "in_flight": ontology_operations_in_flight,
        },
        "postgres": {
            "duration": postgres_query_duration,
            "count": postgres_query_count,
            "errors": postgres_error_count,
            "in_flight": postgres_queries_in_flight,
        },
        "method": {
            "duration": method_duration,
            "count": method_error_count,
            "errors": method_error_count,
            "in_flight": method_calls_in_flight,
        },
    }
    return mapping.get(domain, mapping["method"])


class _MetricRecorder:
    """Lifecycle helper — one instance per call."""

    def __init__(self, domain: MetricDomain, labels: dict) -> None:
        self._instruments = _get_domain_instruments(domain)
        self._labels = labels

    def before(self) -> None:
        self._instruments["in_flight"].add(1, self._labels)

    def after_success(self, duration_ms: float) -> None:
        self._instruments["duration"].record(round(duration_ms, 3), {**self._labels, "status": "success"})
        self._instruments["count"].add(1, {**self._labels, "status": "success"})

    def after_failure(self, duration_ms: float, exc: Exception) -> None:
        err_labels = {**self._labels, "status": "failed", "error_type": type(exc).__name__}
        self._instruments["duration"].record(round(duration_ms, 3), err_labels)
        self._instruments["errors"].add(1, err_labels)

    def finally_(self) -> None:
        self._instruments["in_flight"].add(-1, self._labels)


def capture_metrics(
    domain: MetricDomain,
    operation: str | None = None,
    resource: str | None = None,
    backend: str | None = None,
    extra_labels: dict | None = None,
) -> Callable:
    """
    Decorator factory. Always called with parentheses: ``@capture_metrics(...)``

    Parameters
    ----------
    domain:
        Which metric instruments to use.
        One of: ``gremlin``, ``ontology``, ``postgres``, ``method``.
    operation:
        Verb label e.g. create, update, delete, query.
    resource:
        Model / entity label e.g. domain, entity_type, relation_type.
    backend:
        Storage backend label e.g. postgres, janusgraph, memgraph.
    extra_labels:
        Additional static key/value labels merged into every metric record.
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(self, *args, **kwargs):
            labels = _build_labels(operation, resource, backend, extra_labels)
            recorder = _MetricRecorder(domain=domain, labels=labels)
            recorder.before()
            start = time.perf_counter()
            try:
                result = await func(self, *args, **kwargs)
                recorder.after_success((time.perf_counter() - start) * 1000)
                return result
            except Exception as exc:
                recorder.after_failure((time.perf_counter() - start) * 1000, exc)
                raise
            finally:
                recorder.finally_()

        @functools.wraps(func)
        def sync_wrapper(self, *args, **kwargs):
            labels = _build_labels(operation, resource, backend, extra_labels)
            recorder = _MetricRecorder(domain=domain, labels=labels)
            recorder.before()
            start = time.perf_counter()
            try:
                result = func(self, *args, **kwargs)
                recorder.after_success((time.perf_counter() - start) * 1000)
                return result
            except Exception as exc:
                recorder.after_failure((time.perf_counter() - start) * 1000, exc)
                raise
            finally:
                recorder.finally_()

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

    return decorator


# ── helpers ───────────────────────────────────────────────────────────────────


def _build_labels(
    operation: str | None,
    resource: str | None,
    backend: str | None,
    extra_labels: dict | None,
) -> dict:
    labels: dict = {}
    if operation:
        labels["operation"] = operation
    if resource:
        labels["resource"] = resource
    if backend:
        labels["backend"] = backend
    if extra_labels:
        labels.update(extra_labels)
    return labels
