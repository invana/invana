"""Runtime return types for the LLM client (not API/wire schemas)."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class TokenUsage:
    """Per-call token accounting, normalized across providers."""

    input_tokens: int = 0
    output_tokens: int = 0


@dataclass(slots=True)
class Exchange:
    """What was sent and what came back, as text — for a reader, not for a plan.

    The step dashboard draws these two as its Output band
    (docs/for-developers/modules/operate/features/see-what-ran.md SR42), so they
    are **truncated on write** with the cut stated in the text: a trace row is
    not where a megabyte of prompt belongs.
    """

    prompt: str = ""
    completion: str = ""


@dataclass(slots=True)
class ToolResult:
    """The validated structured object a forced tool / JSON-schema call produced."""

    input: dict
    usage: TokenUsage
    #: The call as a reader would read it. Never empty on a settled call — the
    #: prompt is assembled here rather than reconstructed later, because a
    #: reconstruction is a guess about what was sent.
    exchange: Exchange = field(default_factory=Exchange)
    # Wall-clock spent in the provider call(s) — summed across the corrective
    # round-trip when one happens. Lets callers report LLM time alongside query
    # time so a slow NL turn shows where the time went (docs/for-developers/modules/platform/features/telemetry.md ·
    # docs/for-developers/modules/ask/features/ask-in-natural-language.md).
    duration_ms: float = 0.0
