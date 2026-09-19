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
"""

from __future__ import annotations

import heapq
import itertools
from dataclasses import dataclass, field
from datetime import UTC, datetime

# A person's question is served before a scheduled run (CC3). Everything else is
# first in, first served, which the tiebreaker counter makes exact.
_PRECEDENCE = {"user": 0, "delegation": 1, "task": 2, "schedule": 3}


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
