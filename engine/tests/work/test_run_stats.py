"""The journal's tiles are counted over every run, in the reader's days — see-what-ran.md.

Pinned: the window is the reader's calendar (a run late in the evening there
lands on that day, not on UTC's), the tiles count every root run in it rather
than a page, and a bad zone is refused rather than read as UTC. The journal's
``total`` is a count of the matching roots, not the page length.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.core.errors import ValidationError
from invana.core.lists.params import parse_list_params
from invana.runtime import services
from invana.runtime.managers.run_stats import RunStatsManager
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.schemas import RUN_LIST

_NOW = datetime(2026, 10, 19, 12, 0, tzinfo=UTC)


def _run(graph: Graph, queued: datetime, **kwargs) -> TaskRun:
    return TaskRun(
        graph_id=graph.id,
        workflow_key="nl-single",
        ask_kind="nl",
        queued_at=queued,
        started_at=queued,
        **{"status": RunStatus.succeeded.value, **kwargs},
    )


async def test_tiles_count_every_run_in_the_readers_days(session: AsyncSession, graph: Graph) -> None:
    # 23:30 on the 18th in Lisbon is 22:30 UTC — yesterday there, not today.
    yesterday = datetime(2026, 10, 18, 22, 30, tzinfo=UTC)
    session.add_all(
        [
            _run(
                graph,
                datetime(2026, 10, 19, 9, 0, tzinfo=UTC),
                finished_at=datetime(2026, 10, 19, 9, 0, 4, tzinfo=UTC),
                body="fast",
            ),
            _run(
                graph,
                datetime(2026, 10, 19, 10, 0, tzinfo=UTC),
                finished_at=datetime(2026, 10, 19, 10, 0, 9, tzinfo=UTC),
                body="slow",
                tokens_in=300,
                tokens_out=50,
            ),
            _run(
                graph,
                datetime(2026, 10, 19, 11, 0, tzinfo=UTC),
                finished_at=datetime(2026, 10, 19, 11, 0, 1, tzinfo=UTC),
                status=RunStatus.awaiting_input.value,
            ),
            _run(
                graph, yesterday, finished_at=datetime(2026, 10, 18, 22, 31, tzinfo=UTC), status=RunStatus.failed.value
            ),
        ]
    )
    await session.flush()

    today = await RunStatsManager().stats(
        session, graph_ids=[graph.id], kinds=None, days=1, tz="Europe/Lisbon", now=_NOW
    )
    assert (today.runs, today.succeeded, today.live, today.waiting) == (3, 2, 1, 1)
    assert today.slowest is not None and today.slowest.title == "slow"
    # A run paused on a person, however long ago, is not the slowest.
    long_ago = _run(graph, datetime(2026, 10, 19, 0, 30, tzinfo=UTC), status=RunStatus.awaiting_input.value)
    session.add(long_ago)
    await session.flush()
    waited = await RunStatsManager().stats(
        session, graph_ids=[graph.id], kinds=None, days=1, tz="Europe/Lisbon", now=_NOW
    )
    assert waited.slowest is not None and waited.slowest.title == "slow"
    assert today.median_ms == 6_500
    assert (today.tokens, today.spending_runs) == (350, 1)

    week = await RunStatsManager().stats(
        session, graph_ids=[graph.id], kinds=None, days=2, tz="Europe/Lisbon", now=_NOW
    )
    assert [d.runs for d in week.by_day] == [1, 4]
    assert week.failed == 1

    items, info = await services.list_runs(
        session, graph_id=graph.id, params=parse_list_params(RUN_LIST, {"limit": ["2"]})
    )
    assert len(items) == 2
    assert info.total == 5


async def test_a_bad_zone_is_refused_and_nothing_counts_as_zero(session: AsyncSession, graph: Graph) -> None:
    with pytest.raises(ValidationError):
        await RunStatsManager().stats(session, graph_ids=[graph.id], kinds=None, days=1, tz="Mars/Olympus", now=_NOW)

    empty = await RunStatsManager().stats(session, graph_ids=[graph.id], kinds=None, days=1, tz="UTC", now=_NOW)
    assert (empty.runs, empty.tokens, empty.median_ms, empty.slowest) == (0, 0, None, None)
    assert [d.runs for d in empty.by_day] == [0]
