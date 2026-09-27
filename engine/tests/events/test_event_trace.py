"""An event row carries the trace and span it was written in — real Postgres, real SDK tracer.

``EventManager.emit`` reads both ids off the current span, so no caller passes
them. The fixture points ``invana.core.telemetry.spans`` at a local
``TracerProvider`` with an in-memory exporter, and the row's ids are compared
with the span that exporter was handed.
"""

from __future__ import annotations

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from invana.core.events.managers import EventManager
from invana.core.events.models import ActorKind
from invana.core.telemetry import spans

pytestmark = pytest.mark.asyncio


@pytest.fixture
def exporter(monkeypatch) -> InMemorySpanExporter:
    exp = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exp))
    monkeypatch.setattr(spans._trace, "get_tracer", lambda *a, **k: provider.get_tracer("test.invana.events"))
    return exp


async def test_a_row_written_in_a_span_carries_its_ids(session, exporter):
    with spans.span("t"):
        event = await EventManager().emit(session, action="system.check", actor_kind=ActorKind.system)
    await session.flush()

    (span,) = exporter.get_finished_spans()
    assert event.trace_id == format(span.context.trace_id, "032x")
    assert event.span_id == format(span.context.span_id, "016x")


async def test_a_row_written_outside_any_span_carries_none(session, exporter):
    event = await EventManager().emit(session, action="system.check", actor_kind=ActorKind.system)
    await session.flush()

    assert event.trace_id is None
    assert event.span_id is None
