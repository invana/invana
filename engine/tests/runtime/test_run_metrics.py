"""A run's metrics — against a real Postgres, with stub tasks and a real SDK meter.

The runtime records through ``invana.core.telemetry.recorders``, which read each
instrument off ``invana.core.telemetry.metrics`` at call time; the fixture
points the run instruments at a local ``MeterProvider`` with an
``InMemoryMetricReader``, so what is asserted is what an OTLP exporter would
have been handed.
"""

from __future__ import annotations

import pytest
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader

from invana.core.telemetry import metrics as _m
from tests.runtime.test_run_tracing import _open, _run, stub_tasks  # noqa: F401 — re-exported fixture

pytestmark = [pytest.mark.asyncio, pytest.mark.usefixtures("stub_tasks")]


@pytest.fixture
def reader(monkeypatch) -> InMemoryMetricReader:
    r = InMemoryMetricReader()
    meter = MeterProvider(metric_readers=[r]).get_meter("test.invana.runs")
    monkeypatch.setattr(_m, "runs_duration", meter.create_histogram("invana.runs.duration"))
    monkeypatch.setattr(_m, "runs_queue_wait", meter.create_histogram("invana.runs.queue_wait"))
    monkeypatch.setattr(_m, "runs_step_duration", meter.create_histogram("invana.runs.step.duration"))
    monkeypatch.setattr(_m, "runs_count", meter.create_counter("invana.runs.count"))
    monkeypatch.setattr(_m, "runs_active", meter.create_up_down_counter("invana.runs.active"))
    return r


def _points(reader: InMemoryMetricReader) -> dict[str, list]:
    return {
        m.name: list(m.data.data_points)
        for rm in reader.get_metrics_data().resource_metrics
        for sm in rm.scope_metrics
        for m in sm.metrics
    }


async def test_a_worked_run_records_its_count_duration_steps_and_settles_active(
    session, session_factory, graph, user, reader
):
    th = await _open(session, graph, user, "stub-ok")
    await _run(session_factory, th.id)

    points = _points(reader)
    labels = {"kind": th.ask_kind or "todo", "role": th.role, "triggered_by": th.triggered_by}
    (count,) = points["invana.runs.count"]
    assert dict(count.attributes) == {**labels, "outcome": "ok"}
    assert count.value == 1
    (duration,) = points["invana.runs.duration"]
    assert duration.count == 1 and duration.sum >= 0
    (waited,) = points["invana.runs.queue_wait"]
    assert dict(waited.attributes) == labels and waited.count == 1
    (active,) = points["invana.runs.active"]
    assert active.value == 0
    (steps,) = points["invana.runs.step.duration"]
    assert dict(steps.attributes) == {"step_key": "stub_ok", "outcome": "ok"}
    assert steps.count == 2


async def test_a_failed_run_records_its_outcome_and_the_failed_step(session, session_factory, graph, user, reader):
    th = await _open(session, graph, user, "stub-broken")
    await _run(session_factory, th.id)

    points = _points(reader)
    (count,) = points["invana.runs.count"]
    assert count.attributes["outcome"] == "error"
    (active,) = points["invana.runs.active"]
    assert active.value == 0
    (step,) = points["invana.runs.step.duration"]
    assert dict(step.attributes) == {"step_key": "stub_broken", "outcome": "failed"}
