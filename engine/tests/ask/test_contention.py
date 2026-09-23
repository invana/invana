"""The three bounds in contention.py (concurrency-and-contention.md).

Claims worth a test, and each is a promise about what a person sees: a slot per
run, a person ahead of a schedule (CC3), a queue with a readable position (CC5),
a refusal that names the bound (CC6) — and, for the other two bounds, that an
agent at its own ceiling is refused rather than queued (EB3) and that a full
pool says *which* pool (CC8).
"""

import pytest

from invana.runtime.contention import (
    AgentAtCeiling,
    AgentSlots,
    GraphSlots,
    PoolExhausted,
    PoolSlots,
    Refused,
)

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


class TestTheAgentsOwnCeiling:
    """A budget bounds one agent's simultaneity; the Graph's ceiling bounds the
    machine's. Two bounds, and a refusal has to say which one it was (CC1)."""

    def test_an_agent_works_up_to_its_ceiling(self):
        slots = AgentSlots()
        slots.take(agent_id="a1", run_id="r1", ceiling=2)
        slots.take(agent_id="a1", run_id="r2", ceiling=2)

        assert slots.running_count("a1") == 2

    def test_past_it_the_refusal_names_the_agents_ceiling(self):
        slots = AgentSlots()
        slots.take(agent_id="a1", run_id="r1", ceiling=1)

        with pytest.raises(AgentAtCeiling) as caught:
            slots.take(agent_id="a1", run_id="r2", ceiling=1)

        # Never a queue: an agent has no policy column, so there is nothing for
        # a second queue's precedence to be (EB3).
        assert caught.value.ceiling == 1
        assert caught.value.running == 1
        assert "1 of 1" in str(caught.value)

    def test_a_released_slot_lets_the_next_run_in(self):
        slots = AgentSlots()
        slots.take(agent_id="a1", run_id="r1", ceiling=1)
        slots.release(agent_id="a1", run_id="r1")
        slots.take(agent_id="a1", run_id="r2", ceiling=1)

        assert slots.running_count("a1") == 1

    def test_no_ceiling_bounds_nothing(self):
        """A number nobody set does not narrow — the same reading every other
        ceiling here gives a missing one."""
        slots = AgentSlots()
        for i in range(5):
            slots.take(agent_id="a1", run_id=f"r{i}", ceiling=0)

        assert slots.running_count("a1") == 5


class TestThePools:
    def test_a_full_pool_names_itself(self):
        """*A query error* is the sentence this refusal exists to prevent: the
        question was fine and the machine is busy (CC8)."""
        pools = PoolSlots()
        pools.acquire(graph_id=GRAPH, pool="graphdb", size=1, holder="h1")

        with pytest.raises(PoolExhausted) as caught:
            pools.acquire(graph_id=GRAPH, pool="graphdb", size=1, holder="h2")

        assert caught.value.pool == "graphdb"
        assert caught.value.size == 1
        assert "`graphdb` pool" in str(caught.value)

    def test_two_pools_are_two_scarcities(self):
        """A single number would have to be the smallest of them."""
        pools = PoolSlots()
        pools.acquire(graph_id=GRAPH, pool="llm", size=1, holder="h1")
        pools.acquire(graph_id=GRAPH, pool="graphdb", size=1, holder="h2")

        assert pools.in_use(GRAPH, "llm") == 1
        assert pools.in_use(GRAPH, "graphdb") == 1

    def test_a_run_that_died_mid_crossing_gives_its_slots_back(self):
        """The backstop at settle — a pool that only ever shrinks is worse than
        no pool at all."""
        pools = PoolSlots()
        for pool in ("llm", "graphdb"):
            pools.acquire(
                graph_id=GRAPH,
                pool=pool,
                size=4,
                holder=PoolSlots.holder(run_id="r1", step_key="understand", pool=pool),
            )
        pools.acquire(graph_id=GRAPH, pool="llm", size=4, holder="other-run#x#llm")

        pools.release_run(graph_id=GRAPH, run_id="r1")

        assert pools.in_use(GRAPH, "graphdb") == 0
        # Somebody else's slot is not swept with it.
        assert pools.in_use(GRAPH, "llm") == 1

    def test_the_snapshot_lists_a_quiet_pool_too(self):
        """A pool that appeared only once it was busy would make *is this Graph
        stalled on connections?* unanswerable in the quiet case."""
        pools = PoolSlots()
        pools.acquire(graph_id=GRAPH, pool="llm", size=2, holder="h1")

        assert pools.snapshot(GRAPH, {"llm": 2, "graphdb": 50}) == [
            {"pool": "graphdb", "size": 50, "in_use": 0},
            {"pool": "llm", "size": 2, "in_use": 1},
        ]
