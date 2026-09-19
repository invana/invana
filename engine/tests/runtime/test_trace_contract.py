"""Every keyword the trace route passes is a field of the model it builds.

`GET …/runs/{id}/trace` is what both dashboards read (see-what-ran.md SR30),
and it raised a `ValidationError` on every call for as long as it took anyone
to open one: the `thinking_id` → `parent_run_id` rename landed on the keyword
argument and not on the field, so `TraceRead(parent_run_id=…)` silently dropped
an unknown key and then failed for a missing `run_id`.

Pydantic will not catch that at import time and mypy does not run on this
repo, so this asserts the *call* against the *model* — statically, with no
database — which is the only place the two can be compared before a request.
"""

from __future__ import annotations

import ast
from pathlib import Path

from invana.runtime.schemas import TraceRead, TraceStep

_ROUTE = Path(__file__).resolve().parents[2] / "src" / "invana" / "server" / "runtime" / "runs.py"


def _keywords_passed_to(name: str) -> set[str]:
    """The keyword names of every `name(...)` call in the trace route."""
    tree = ast.parse(_ROUTE.read_text())
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == name:
            found.update(kw.arg for kw in node.keywords if kw.arg)
    return found


def test_the_trace_passes_only_fields_the_read_model_has() -> None:
    passed = _keywords_passed_to("TraceRead")
    assert passed, "expected the route to build a TraceRead; the call may have moved"
    assert passed <= set(TraceRead.model_fields), (
        f"passed but not a field: {sorted(passed - set(TraceRead.model_fields))}"
    )


def test_the_trace_passes_only_fields_a_step_has() -> None:
    passed = _keywords_passed_to("TraceStep")
    assert passed, "expected the route to build a TraceStep; the call may have moved"
    assert passed <= set(TraceStep.model_fields), (
        f"passed but not a field: {sorted(passed - set(TraceStep.model_fields))}"
    )


def test_a_step_carries_what_the_step_dashboard_renders() -> None:
    """SR33 — Input, the bound chip, Where it sits and `result.json`."""
    assert {"args", "bound", "step_key", "lane", "result"} <= set(TraceStep.model_fields)


def test_the_trace_carries_a_spend_and_the_ceiling_it_is_drawn_against() -> None:
    """SR41 — a spend without its ceiling is a number nobody can act on (SR20)."""
    assert "cost_usd" in TraceStep.model_fields
    assert {"cost_usd", "budget"} <= set(TraceRead.model_fields)
