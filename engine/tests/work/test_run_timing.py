"""A run stores its own timing and tokens — metrics-are-stored.md.

Two things are pinned: the **hook** (every flush of a row keeps its duration in
step with its timestamps, and a resumed run loses the roll-up it no longer
earns) and the **roll-up** (work is what the steps did; a step paused on a
person is the wait, and the gap until the run resumed is the asking).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.results import roll_up_run

_T0 = datetime(2026, 10, 19, 12, 0, 0, tzinfo=UTC)


def _at(seconds: float) -> datetime:
    return _T0 + timedelta(seconds=seconds)


async def test_a_flushed_row_stores_its_duration_and_a_resume_clears_it(session: AsyncSession, graph: Graph) -> None:
    root = TaskRun(graph_id=graph.id, queued_at=_at(0), started_at=_at(1), status=RunStatus.running.value)
    session.add(root)
    await session.flush()
    assert root.queue_ms == 1000
    assert root.duration_ms is None

    root.finished_at = _at(13)
    root.work_ms = 12_000
    root.tokens_in = 40
    await session.flush()
    assert root.duration_ms == 12_000
    assert root.tokens == 40

    root.finished_at = None
    await session.flush()
    assert root.duration_ms is None
    assert root.work_ms is None


def test_work_excludes_a_paused_step_and_asking_is_the_gap_until_resume() -> None:
    root = TaskRun(graph_id="g", started_at=_at(0), finished_at=_at(70))
    nodes = [
        TaskRun(graph_id="g", seq=0, status="succeeded", started_at=_at(0), finished_at=_at(5)),
        TaskRun(graph_id="g", seq=1, status="needs_input", started_at=_at(5), finished_at=_at(6)),
        TaskRun(graph_id="g", seq=2, status="succeeded", started_at=_at(66), finished_at=_at(70)),
    ]
    nodes[0].tokens_in, nodes[0].tokens_out = 120, 30
    roll_up_run(root, nodes)
    assert (root.run_tokens_in, root.run_tokens_out, root.run_tokens) == (120, 30, 150)
    assert root.work_ms == 9_000
    assert root.ask_ms == 60_000
    assert root.wait_ms == 61_000


def test_a_run_that_never_started_has_no_roll_up() -> None:
    root = TaskRun(graph_id="g", queued_at=_at(0), finished_at=_at(1))
    roll_up_run(root, [])
    assert root.work_ms is None
    assert root.ask_ms is None
    assert root.wait_ms is None
    assert root.run_tokens is None
