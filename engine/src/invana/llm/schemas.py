"""Runtime return types for the LLM client (not API/wire schemas)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class TokenUsage:
    """Per-call token accounting, normalized across providers."""

    input_tokens: int = 0
    output_tokens: int = 0


@dataclass(slots=True)
class ToolResult:
    """The validated structured object a forced tool / JSON-schema call produced."""

    input: dict
    usage: TokenUsage
    # Wall-clock spent in the provider call(s) — summed across the corrective
    # round-trip when one happens. Lets callers report LLM time alongside query
    # time so a slow NL turn shows where the time went (RFC-025/030).
    duration_ms: float = 0.0
