"""The Graph's ceiling — how many runs run at once, and what waits.

A budget bounds one agent's spend; nothing bounded the Graph
(docs/for-developers/modules/agents/features/concurrency-and-contention.md). This
is the outermost bound in the same family as an envelope and a budget: one level
up, and per Graph.

Four rules it keeps, and each one is a promise about what a person sees:

| Rule | What it prevents |
|---|---|
| A slot per run, children included (CC4) | a parent's fan-out quietly multiplying the Graph's load |
| A person outranks a schedule (CC3) | Monday's five recurrences making an ad-hoc question wait behind them |
| Queued is a **visible state** with a position (CC5) | a run that looks stalled with nothing to read |
| A refusal names the bound (CC6) | "something went wrong" where "the ceiling is 4" was the truth |

The queue lives in this process, because the runtime does
(docs/for-developers/modules/ask/features/runtime-and-adapters.md). A restart
fails whatever was mid-flight and drops whatever was waiting — the same story the
in-flight runs already have, rather than a second, quieter one.

**Three bounds live here, and they are not the same bound.** Each refuses by
naming itself, which is the whole of CC6:

| Bound | Scope | At the ceiling |
|---|---|---|
| :class:`GraphSlots` | runs at once, per Graph | the Graph's `concurrency_policy` — queue with a position, or refuse |
| :class:`AgentSlots` | runs at once, per **agent** | refuses — an agent has no policy column (CC2 · EB3) |
| :class:`PoolSlots` | crossings at once, per pool | refuses, naming the pool — `llm` · `graphdb` · `heavy` (CC8) |

A run slot says *this run may proceed*; a pool slot says *this crossing may
happen now*. Held across one crossing rather than one run, so a run waiting on a
model is not also holding a database connection it is not using.
"""

from __future__ import annotations

import heapq
import itertools
from dataclasses import dataclass, field
from datetime import UTC, datetime

# A person's question is served before a scheduled run (CC3). Everything else is
# first in, first served, which the tiebreaker counter makes exact.
#: A canvas run waits like a user's — a person is waiting on both — and a
#: system run like a schedule's (RP31).
_PRECEDENCE = {"user": 0, "canvas": 0, "delegation": 1, "task": 2, "schedule": 3, "system": 3}


@dataclass(order=True)
class _Waiting:
    precedence: int
    ticket: int
    run_id: str = field(compare=False)
    triggered_by: str = field(compare=False)
    queued_at: datetime = field(compare=False)


class Refused(Exception):
    """The Graph is at its ceiling and its policy is to refuse (CC2).

    Carries the bound by name, because "refused" without the number is the
    generic failure this module exists to avoid (CC6).
    """

    def __init__(self, *, graph_id: str, ceiling: int, running: int) -> None:
        super().__init__(f"This Graph is already running {running} of {ceiling} runs.")
        self.graph_id = graph_id
        self.ceiling = ceiling
        self.running = running


class AgentAtCeiling(Exception):
    """This **agent** is already working as many runs as its budget allows.

    A different bound from :class:`Refused`, which is the Graph's
    ([CC1](docs/for-developers/modules/agents/features/concurrency-and-contention.md)):
    a budget bounds one agent's simultaneity, the Graph's ceiling bounds the
    machine's. They are checked in that order, so an agent at its own ceiling is
    told about *its* ceiling rather than queued behind the Graph's.

    **It refuses and never queues.** `queue` and `refuse` are a policy stated on
    the Graph about the Graph's ceiling (CC2); an agent has no such column, and
    inventing a second queue with its own precedence would make *why am I
    waiting* two answers instead of one. A refusal names the bound
    ([EB3](docs/for-developers/modules/agents/features/envelope-and-budget.md)).
    """

    def __init__(self, *, agent_id: str, ceiling: int, running: int) -> None:
        super().__init__(f"This agent is already working {running} of {ceiling} runs.")
        self.agent_id = agent_id
        self.ceiling = ceiling
        self.running = running


class AgentSlots:
    """How many runs each agent is working, and the ceiling it stops at.

    Counting, not queueing — which is why it is a handful of lines beside
    :class:`GraphSlots` rather than a second copy of it.
    """

    def __init__(self) -> None:
        self._running: dict[str, set[str]] = {}

    def take(self, *, agent_id: str, run_id: str, ceiling: int) -> None:
        """Claim a slot for this agent, or raise :class:`AgentAtCeiling`.

        ``ceiling <= 0`` is *unbounded*, the same reading the Graph's ceiling
        gives it — a number nobody set does not bound anything
        ([GV7](docs/for-developers/modules/govern/spec.md), one family over).
        """
        running = self._running.setdefault(agent_id, set())
        if run_id in running or ceiling <= 0:
            running.add(run_id)
            return
        if len(running) >= ceiling:
            raise AgentAtCeiling(agent_id=agent_id, ceiling=ceiling, running=len(running))
        running.add(run_id)

    def release(self, *, agent_id: str, run_id: str) -> None:
        self._running.setdefault(agent_id, set()).discard(run_id)

    def running_count(self, agent_id: str) -> int:
        return len(self._running.get(agent_id, ()))


@dataclass
class Admission:
    """What happened when a run asked for a slot."""

    admitted: bool
    #: 1-based, and only when queued — what the task shows (C5).
    position: int | None = None
    ceiling: int = 0
    running: int = 0


class GraphSlots:
    """Slot accounting and the wait queue, per Graph.

    Deliberately not a semaphore: a semaphore can say *wait*, but it cannot say
    *third in line, behind two scheduled runs* — and that sentence is the whole
    point of C5.
    """

    def __init__(self) -> None:
        self._running: dict[str, set[str]] = {}
        self._queues: dict[str, list[_Waiting]] = {}
        self._tickets = itertools.count()

    # ── admission ─────────────────────────────────────────────────────────────

    def admit(
        self,
        *,
        graph_id: str,
        run_id: str,
        ceiling: int,
        policy: str,
        triggered_by: str = "user",
    ) -> Admission:
        """Take a slot, or join the queue — or refuse, when that is the policy."""
        running = self._running.setdefault(graph_id, set())
        if run_id in running:
            return Admission(admitted=True, ceiling=ceiling, running=len(running))

        if ceiling <= 0 or len(running) < ceiling:
            running.add(run_id)
            return Admission(admitted=True, ceiling=ceiling, running=len(running))

        if policy == "refuse":
            raise Refused(graph_id=graph_id, ceiling=ceiling, running=len(running))

        queue = self._queues.setdefault(graph_id, [])
        heapq.heappush(
            queue,
            _Waiting(
                precedence=_PRECEDENCE.get(triggered_by, 2),
                ticket=next(self._tickets),
                run_id=run_id,
                triggered_by=triggered_by,
                queued_at=datetime.now(UTC),
            ),
        )
        return Admission(
            admitted=False,
            position=self.position(graph_id, run_id),
            ceiling=ceiling,
            running=len(running),
        )

    def release(self, *, graph_id: str, run_id: str) -> str | None:
        """Give the slot back and hand it to whoever is next. Returns that id."""
        running = self._running.setdefault(graph_id, set())
        running.discard(run_id)
        queue = self._queues.get(graph_id)
        if not queue:
            return None
        nxt = heapq.heappop(queue)
        running.add(nxt.run_id)
        return nxt.run_id

    def withdraw(self, *, graph_id: str, run_id: str) -> bool:
        """Take a queued run out of the line — a cancel, before it ever started.

        The others move up on their own: position is computed from the heap, so
        nothing has to be renumbered.
        """
        queue = self._queues.get(graph_id)
        if not queue:
            return False
        remaining = [w for w in queue if w.run_id != run_id]
        if len(remaining) == len(queue):
            return False
        heapq.heapify(remaining)
        self._queues[graph_id] = remaining
        return True

    # ── reading it ────────────────────────────────────────────────────────────

    def position(self, graph_id: str, run_id: str) -> int | None:
        """1-based place in line, in the order slots will actually be handed out."""
        queue = self._queues.get(graph_id) or []
        for index, waiting in enumerate(sorted(queue), start=1):
            if waiting.run_id == run_id:
                return index
        return None

    def running_count(self, graph_id: str) -> int:
        return len(self._running.get(graph_id, ()))

    def queued_count(self, graph_id: str) -> int:
        return len(self._queues.get(graph_id) or ())

    def snapshot(self, graph_id: str) -> dict:
        """What is running, what is waiting, and behind what — the Graph's own view (C8)."""
        queue = sorted(self._queues.get(graph_id) or [])
        return {
            "running": sorted(self._running.get(graph_id, ())),
            "queued": [
                {
                    "run_id": w.run_id,
                    "position": index,
                    "triggered_by": w.triggered_by,
                    "queued_at": w.queued_at.isoformat(),
                }
                for index, w in enumerate(queue, start=1)
            ],
        }


class PoolExhausted(Exception):
    """A named pool had no slot left, and the pool is what to say (CC8).

    *A query error* is the sentence this class exists to prevent: a run that
    could not get a database connection did not ask a bad question, and telling
    it so sends the reader to fix the query. The pool and its size are the
    actionable facts, so they ride on the exception
    ([CC6](docs/for-developers/modules/agents/features/concurrency-and-contention.md)).
    """

    def __init__(self, *, graph_id: str, pool: str, size: int) -> None:
        super().__init__(f"The `{pool}` pool on this Graph is full — all {size} slots are in use.")
        self.graph_id = graph_id
        self.pool = pool
        self.size = size


class PoolSlots:
    """The three pools a run draws on while it holds its slot (CC8).

    A run slot says *this run may proceed*; a pool slot says *this crossing may
    happen now*. They are different scarcities and a single number would have to
    be the smallest of them — `llm` is a provider's concurrency, `graphdb` is a
    connection pool, `heavy` is CPU and memory. A pool nobody configured is
    unbounded, which is the same reading every other ceiling here gives a
    missing number.

    **Held across one crossing, not one run.** `acquire` / `release` bracket the
    call, so a run that waits five seconds on a model is not also holding a
    database connection it is not using.

    **And released again whatever happens**, by :meth:`release_run` when the run
    settles: a crossing that raises between its two halves would otherwise leak
    a slot, and a pool that only ever shrinks is worse than no pool at all. The
    holder key carries the run id so the backstop can find it, which is the
    whole reason it is a string rather than an object.

    In this process, like the queue (CC7): a restart drops the accounting along
    with the runs it was accounting for.
    """

    def __init__(self) -> None:
        self._held: dict[tuple[str, str], set[str]] = {}

    @staticmethod
    def holder(*, run_id: str, step_key: str | None, pool: str) -> str:
        """The key one crossing holds a slot under.

        The crossing, not the run: a run makes several, and two of them may be
        in flight at once. Prefixed with the run so :meth:`release_run` can
        sweep them without being told which pools were touched.
        """
        return f"{run_id}#{step_key or '-'}#{pool}"

    def acquire(self, *, graph_id: str, pool: str, size: int, holder: str) -> None:
        """Take a slot in ``pool``, or raise :class:`PoolExhausted`."""
        held = self._held.setdefault((graph_id, pool), set())
        if holder in held or size <= 0:
            held.add(holder)
            return
        if len(held) >= size:
            raise PoolExhausted(graph_id=graph_id, pool=pool, size=size)
        held.add(holder)

    def release(self, *, graph_id: str, pool: str, holder: str) -> None:
        self._held.setdefault((graph_id, pool), set()).discard(holder)

    def release_run(self, *, graph_id: str, run_id: str) -> None:
        """Drop every slot this run still holds — the backstop, at settle."""
        prefix = f"{run_id}#"
        for (held_graph, _pool), holders in self._held.items():
            if held_graph != graph_id:
                continue
            for holder in [h for h in holders if h.startswith(prefix)]:
                holders.discard(holder)

    def in_use(self, graph_id: str, pool: str) -> int:
        return len(self._held.get((graph_id, pool), ()))

    def snapshot(self, graph_id: str, pools: dict[str, int]) -> list[dict]:
        """Each configured pool, its size and what is in it — what C8 draws."""
        return [
            {"pool": name, "size": int(size), "in_use": self.in_use(graph_id, name)}
            for name, size in sorted(pools.items())
        ]
