"""The derived plan (docs/for-developers/modules/work/spec.mda) — pure functions, no database.

Order is derived, so the thing worth testing is the derivation: waves, the
critical path, what counts as blocked, and that a cycle is caught *before* it
can make any of those undefined.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from invana.apps.work.plan import DependencyCycle, assert_acyclic, derive, find_cycle

BASE = datetime(2026, 9, 1, tzinfo=UTC)


def task(tid: str, *, status: str = "open", due_days: int | None = None, created_days: int = 0):
    due = BASE + timedelta(days=due_days) if due_days is not None else None
    return (tid, status, due, BASE + timedelta(days=created_days))


class TestWaves:
    def test_a_chain_gets_one_task_per_wave_and_is_the_critical_path(self):
        plan = derive([task("a"), task("b"), task("c")], [("a", "b"), ("b", "c")])
        by_id = plan.by_id()
        assert [by_id[t].wave for t in ("a", "b", "c")] == [1, 2, 3]
        assert plan.critical_path == ["a", "b", "c"]

    def test_siblings_share_a_wave_so_they_can_run_in_parallel(self):
        plan = derive([task("root"), task("x"), task("y")], [("root", "x"), ("root", "y")])
        by_id = plan.by_id()
        assert by_id["x"].wave == by_id["y"].wave == 2

    def test_a_wave_is_the_longest_path_not_the_shortest(self):
        # d waits on c, which waits on a; d also waits on a directly. The long
        # route is what decides when d can start.
        plan = derive(
            [task("a"), task("c"), task("d")],
            [("a", "c"), ("c", "d"), ("a", "d")],
        )
        assert plan.by_id()["d"].wave == 3

    def test_nothing_depending_on_anything_has_no_critical_path(self):
        # A "critical path" of one task is just a task; painting it would make
        # the canvas lie about what matters.
        plan = derive([task("a"), task("b")], [])
        assert plan.critical_path == []

    def test_order_breaks_ties_by_due_date_then_creation(self):
        plan = derive(
            [task("late", due_days=9), task("soon", due_days=1), task("undated", created_days=5)],
            [],
        )
        assert [t.id for t in plan.tasks] == ["soon", "late", "undated"]


class TestBlocking:
    def test_blocked_by_lists_only_dependencies_that_are_not_done(self):
        plan = derive(
            [task("done_one", status="done"), task("open_one"), task("waiter")],
            [("done_one", "waiter"), ("open_one", "waiter")],
        )
        assert plan.by_id()["waiter"].blocked_by == ["open_one"]

    def test_a_task_whose_dependencies_all_closed_is_not_blocked(self):
        plan = derive([task("a", status="done"), task("b")], [("a", "b")])
        assert plan.by_id()["b"].blocked_by == []


class TestCycles:
    def test_a_loop_is_found_and_named(self):
        loop = find_cycle([("a", "b"), ("b", "c"), ("c", "a")])
        assert loop is not None
        # Named so the 422 can print it; a bare rejection is not actionable on
        # a canvas the user just dragged on.
        assert set(loop) == {"a", "b", "c"}

    def test_a_dag_has_no_cycle(self):
        assert find_cycle([("a", "b"), ("a", "c"), ("b", "d"), ("c", "d")]) is None

    def test_assert_acyclic_raises_with_the_loop_attached(self):
        with pytest.raises(DependencyCycle) as caught:
            assert_acyclic([("x", "y"), ("y", "x")])
        assert set(caught.value.loop) == {"x", "y"}

    def test_a_cycle_degrades_rather_than_hanging(self):
        # derive() should never be reached with a cycle — the write path
        # rejects it — but if one exists it must terminate.
        plan = derive([task("a"), task("b")], [("a", "b"), ("b", "a")])
        assert {t.id for t in plan.tasks} == {"a", "b"}
