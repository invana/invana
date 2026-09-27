"""Every event row written counts on ``invana.events.emitted`` — real Postgres, real SDK meter.

``record_event`` reads the counter off ``invana.core.telemetry.metrics`` at call
time; the fixture points it at a local ``MeterProvider`` with an
``InMemoryMetricReader``.
"""

from __future__ import annotations

import pytest
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader

from invana.core.events.managers import EventManager
from invana.core.events.models import ActorKind
from invana.core.telemetry import metrics as _m

pytestmark = pytest.mark.asyncio


async def test_emit_counts_the_row_by_action(session, monkeypatch):
    reader = InMemoryMetricReader()
    meter = MeterProvider(metric_readers=[reader]).get_meter("test.invana.events")
    monkeypatch.setattr(_m, "events_emitted", meter.create_counter("invana.events.emitted"))

    for _ in range(2):
        await EventManager().emit(session, action="system.check", actor_kind=ActorKind.system)

    [metric] = [m for rm in reader.get_metrics_data().resource_metrics for sm in rm.scope_metrics for m in sm.metrics]
    (point,) = metric.data.data_points
    assert metric.name == "invana.events.emitted"
    assert dict(point.attributes) == {"action": "system.check"}
    assert point.value == 2
