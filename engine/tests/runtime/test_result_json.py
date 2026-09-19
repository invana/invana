"""``result.json`` is assembled from the settled row, and only the declared keys reach it.

see-what-ran.md SR38 · SR39. Two things are worth pinning: the **filter** (an
entry's declaration is the contract, so a key it recorded about itself stays off
the document) and the **absences** (SR34 — a task with no artifacts has no
`artifacts` key, not an empty list, because an empty box claims the task
produced none).
"""

from __future__ import annotations

from datetime import UTC, datetime

from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.results import run_result, step_result

_START = datetime(2026, 9, 17, 12, 0, 0, tzinfo=UTC)
_END = datetime(2026, 9, 17, 12, 0, 2, tzinfo=UTC)


def _step(**kwargs) -> TaskRun:
    return TaskRun(
        graph_id="g",
        task_key="validate_records",
        step_key="validate_a",
        started_at=_START,
        finished_at=_END,
        attempt=1,
        **{"status": RunStatus.succeeded.value, **kwargs},
    )


def test_a_task_records_only_what_its_entry_declares() -> None:
    """`validate_records` declares total · reported · model · version — and nothing else."""
    row = _step(output={"total": 12, "reported": 1, "model": "orders", "version": 2, "scratch": "internal"})
    result = step_result(row)

    assert result["outputs"] == {"total": 12, "reported": 1, "model": "orders", "version": 2}
    assert result["status"] == "succeeded"
    assert result["step_key"] == "validate_a"
    assert result["timing"]["duration_ms"] == 2000


def test_an_undeclared_key_and_an_unknown_entry_contribute_nothing() -> None:
    """The negative of the same rule, at both ends of it."""
    only_undeclared = step_result(_step(output={"prompt": "…", "completion": "…"}))
    assert "outputs" not in only_undeclared

    unknown = _step(output={"total": 3})
    unknown.task_key = "an_entry_the_catalogue_never_had"
    assert "outputs" not in step_result(unknown)


def test_a_band_with_no_record_has_no_key() -> None:
    """SR34 — absent, not empty. An unpriced, artifact-less, tokenless step."""
    result = step_result(_step(output={"total": 1}), artifacts=[])
    assert "artifacts" not in result
    assert "tokens" not in result
    assert "cost_usd" not in result
    assert "error" not in result


def test_an_artifact_and_a_failure_do_reach_the_document() -> None:
    row = _step(status=RunStatus.failed.value, error={"cls": "blocked", "cause": "no_source"})
    result = step_result(row, artifacts=[{"name": "nodes/people.json", "direction": "read"}])
    assert result["artifacts"] == [{"name": "nodes/people.json", "direction": "read"}]
    assert result["error"]["cause"] == "no_source"
    assert result["status"] == "failed"


def test_a_run_rolls_its_tasks_up_rather_than_copying_them() -> None:
    """SR39 — one line per task, its artifacts carried, its full document not."""
    first = _step(output={"total": 4, "reported": 0}, tokens_in=100, tokens_out=20, cost_usd=0.0013)
    first.result = step_result(first, artifacts=[{"name": "nodes/a.json", "direction": "read"}])
    second = _step(output={"total": 9, "reported": 2})
    second.step_key = "validate_b"
    second.result = step_result(second)

    run = TaskRun(
        graph_id="g",
        status=RunStatus.succeeded.value,
        outcome="answered",
        started_at=_START,
        finished_at=_END,
    )
    result = run_result(run, [first, second])

    assert [task["step_key"] for task in result["tasks"]] == ["validate_a", "validate_b"]
    assert result["tasks"][0]["outputs"] == {"total": 4, "reported": 0}
    assert result["artifacts"] == [{"name": "nodes/a.json", "direction": "read"}]
    assert result["tokens"] == {"in": 100, "out": 20}
    assert result["cost_usd"] == 0.0013
    assert result["outcome"] == "answered"
