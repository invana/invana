"""A short-lived process exits on time, and keeps shipping logs, whatever the collector does.

Real SDK providers and a real OTLP exporter aimed at a port nothing listens on:
the exporter retries for about twenty seconds, which is what used to hold a CLI
command's exit up. Logging is changed in place, then rebuilt the way the process
started, so the rest of the suite sees the pipeline it expects.
"""

from __future__ import annotations

import logging
import time

from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from invana.core.logging import configure_logging, set_level
from invana.core.settings import settings
from invana.core.telemetry.setup import _shutdown_within


def test_an_unreachable_collector_cannot_hold_the_exit_up():
    provider = TracerProvider()  # registers its own exit hook, as in the CLI
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint="http://127.0.0.1:1", insecure=True)))
    provider.get_tracer("test").start_span("work").end()

    started = time.monotonic()
    _shutdown_within([provider], timeout_millis=300)

    assert time.monotonic() - started < 2
    assert provider._atexit_handler is None  # interpreter exit will not shut it down again, unbounded


def test_a_reachable_exporter_gets_everything_before_the_shutdown():
    exporter = InMemorySpanExporter()
    provider = TracerProvider(shutdown_on_exit=False)
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    provider.get_tracer("test").start_span("work").end()

    _shutdown_within([provider], timeout_millis=2000)

    assert [s.name for s in exporter.get_finished_spans()] == ["work"]


def test_changing_the_level_keeps_every_handler():
    root = logging.getLogger()
    shipped = logging.NullHandler()  # stands in for the OTLP handler telemetry adds
    root.addHandler(shipped)
    try:
        set_level("WARNING")
        console = next(h for h in root.handlers if h.get_name() == "console")
        assert shipped in root.handlers
        assert (root.level, logging.getLogger("invana").level, console.level) == (logging.WARNING,) * 3
    finally:
        root.removeHandler(shipped)
        configure_logging(level=settings.log_level)
