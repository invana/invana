"""Trace sampling tests: the ratio sampler and its setting.

A ratio of zero drops every new root trace, but a span whose remote parent was
sampled (the studio's ``traceparent``) is still kept, so a distributed trace is
never cut in half. The setting refuses a ratio outside 0 to 1.
"""

from __future__ import annotations

import pytest
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.trace import NonRecordingSpan, SpanContext, TraceFlags
from pydantic import ValidationError

from invana.core.settings import Settings
from invana.core.telemetry.setup import _sampler


def test_zero_ratio_drops_roots_but_follows_a_sampled_parent() -> None:
    """With ratio 0 a root span is not sampled; a child of a sampled remote parent is."""
    tracer = TracerProvider(sampler=_sampler(0.0)).get_tracer("test.invana")

    with tracer.start_as_current_span("root") as root:
        assert not root.get_span_context().trace_flags.sampled

    parent = SpanContext(
        trace_id=0x0AF7651916CD43DD8448EB211C80319C,
        span_id=0xB7AD6B7169203331,
        is_remote=True,
        trace_flags=TraceFlags(TraceFlags.SAMPLED),
    )
    ctx = trace.set_span_in_context(NonRecordingSpan(parent))
    with tracer.start_as_current_span("child", context=ctx) as child:
        assert child.get_span_context().trace_flags.sampled


def test_sample_ratio_above_one_is_rejected() -> None:
    """A ratio outside 0 to 1 fails settings validation."""
    with pytest.raises(ValidationError):
        Settings(telemetry_sample_ratio=1.5)
