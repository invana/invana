"""The Graph's ceiling (concurrency-and-contention.md).

Four claims worth a test, and each is a promise about what a person sees: a slot
per run, a person ahead of a schedule (CC3), a queue with a readable position
(CC5), and a refusal that names the bound (CC6).
"""

import pytest

from invana.runtime.contention import GraphSlots, Refused

GRAPH = "g1"


def admit(slots: GraphSlots, run_id: str, *, ceiling=2, policy="queue", triggered_by="user"):
    return slots.admit(
        graph_id=GRAPH,
        run_id=run_id,
        ceiling=ceiling,
        policy=policy,
        triggered_by=triggered_by,
    )


class TestCeiling:
    def test_runs_start_until_the_ceiling(self):
        slots = GraphSlots()
        assert admit(slots, "a").admitted is True
        assert admit(slots, "b").admitted is True
        assert slots.running_count(GRAPH) == 2

    def test_over_the_ceiling_queues_with_a_position(self):
        slots = GraphSlots()
        admit(slots, "a")
        admit(slots, "b")
        queued = admit(slots, "c")

        assert queued.admitted is False
        assert queued.position == 1
        assert queued.ceiling == 2
        assert slots.queued_count(GRAPH) == 1

    def test_refuse_names_the_bound(self):
        slots = GraphSlots()
        admit(slots, "a", policy="refuse")
        admit(slots, "b", policy="refuse")

        with pytest.raises(Refused) as exc:
            admit(slots, "c", policy="refuse")
        assert exc.value.ceiling == 2
        assert exc.value.running == 2
        assert "2 of 2" in str(exc.value)

    def test_no_ceiling_admits_everything(self):
        slots = GraphSlots()
        assert admit(slots, "a", ceiling=0).admitted is True
        assert admit(slots, "b", ceiling=0).admitted is True
        assert admit(slots, "c", ceiling=0).admitted is True


class TestPrecedence:
    def test_a_person_is_served_before_a_schedule(self):
        slots = GraphSlots()
        admit(slots, "a")
        admit(slots, "b")
        admit(slots, "sched", triggered_by="schedule")
        admit(slots, "asked", triggered_by="user")

        # The person queued second and is first in line anyway (CC3).
        assert slots.position(GRAPH, "asked") == 1
        assert slots.position(GRAPH, "sched") == 2
        assert slots.release(graph_id=GRAPH, run_id="a") == "asked"

    def test_otherwise_first_in_first_served(self):
        slots = GraphSlots()
        admit(slots, "a")
        admit(slots, "b")
        admit(slots, "first", triggered_by="schedule")
        admit(slots, "second", triggered_by="schedule")

        assert slots.release(graph_id=GRAPH, run_id="a") == "first"


class TestLeavingTheQueue:
    def test_a_cancelled_queued_run_leaves_and_the_rest_move_up(self):
        slots = GraphSlots()
        admit(slots, "a")
        admit(slots, "b")
        admit(slots, "c")
        admit(slots, "d")
        assert slots.position(GRAPH, "d") == 2

        assert slots.withdraw(graph_id=GRAPH, run_id="c") is True
        assert slots.position(GRAPH, "d") == 1
        assert slots.queued_count(GRAPH) == 1

    def test_a_release_with_nobody_waiting_hands_the_slot_to_nobody(self):
        slots = GraphSlots()
        admit(slots, "a")
        assert slots.release(graph_id=GRAPH, run_id="a") is None
        assert slots.running_count(GRAPH) == 0

    def test_the_snapshot_says_what_is_waiting_behind_what(self):
        slots = GraphSlots()
        admit(slots, "a")
        admit(slots, "b")
        admit(slots, "sched", triggered_by="schedule")

        snapshot = slots.snapshot(GRAPH)
        assert snapshot["running"] == ["a", "b"]
        assert snapshot["queued"][0]["run_id"] == "sched"
        assert snapshot["queued"][0]["position"] == 1
