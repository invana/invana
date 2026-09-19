"""The derived plan: order, waves, blocked-by and the critical path.

**Order is derived, never typed** (docs/for-developers/modules/work/spec.mda). There is deliberately no
manual rank column: two sources of order disagree, and the dependency graph is
the one the agents obey. Everything here is a pure function over
``(tasks, edges)`` so it can be reasoned about — and tested — without a
database.

A *wave* is `1 + max(wave of dependencies)`; roots are wave 1. Tasks in one
wave can run in parallel, and waves run left to right — which is exactly how
the Plan canvas draws them.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime

from invana.apps.work.models import TaskStatus

# Sorted last, so a task with no due date follows the ones that have one.
# Timezone-aware: `due_at` is, and Python refuses to compare the two kinds.
_FAR_FUTURE = datetime.max.replace(tzinfo=UTC)


class DependencyCycle(ValueError):
    """Adding this dependency would close a loop.

    Carries the loop so the 422 can *name* it — "nothing drawn, and here is
    why" beats a generic rejection on a canvas the user just dragged on.
    """

    def __init__(self, loop: list[str]) -> None:
        super().__init__(" → ".join(loop))
        self.loop = loop


@dataclass(slots=True)
class PlanTask:
    """One task's derived position in the plan."""

    id: str
    wave: int = 1
    blocked_by: list[str] = field(default_factory=list)
    critical: bool = False
    order: int = 0


@dataclass(slots=True)
class DerivedPlan:
    tasks: list[PlanTask]
    edges: list[tuple[str, str]]
    critical_path: list[str]

    def by_id(self) -> dict[str, PlanTask]:
        return {t.id: t for t in self.tasks}


def find_cycle(edges: list[tuple[str, str]]) -> list[str] | None:
    """Return one cycle as a node list, or None. Edges are ``(from, to)`` where
    *from* must finish before *to* starts."""
    successors: dict[str, list[str]] = defaultdict(list)
    nodes: set[str] = set()
    for src, dst in edges:
        successors[src].append(dst)
        nodes.update((src, dst))

    WHITE, GREY, BLACK = 0, 1, 2
    colour: dict[str, int] = dict.fromkeys(nodes, WHITE)
    stack: list[str] = []

    def visit(node: str) -> list[str] | None:
        colour[node] = GREY
        stack.append(node)
        for nxt in successors.get(node, ()):
            if colour.get(nxt, WHITE) == GREY:
                return [*stack[stack.index(nxt) :], nxt]
            if colour.get(nxt, WHITE) == WHITE:
                found = visit(nxt)
                if found is not None:
                    return found
        stack.pop()
        colour[node] = BLACK
        return None

    for node in sorted(nodes):
        if colour[node] == WHITE:
            found = visit(node)
            if found is not None:
                return found
    return None


def assert_acyclic(edges: list[tuple[str, str]]) -> None:
    loop = find_cycle(edges)
    if loop is not None:
        raise DependencyCycle(loop)


def derive(
    tasks: list[tuple[str, str, datetime | None, datetime]],
    edges: list[tuple[str, str]],
) -> DerivedPlan:
    """Compute waves, blocked-by, the critical path and the derived order.

    ``tasks`` is ``(id, status, due_at, created_at)``; ``edges`` is
    ``(depends_on_id, task_id)`` — the direction work flows.

    A cycle would make waves undefined, so it is rejected at write time
    (:func:`assert_acyclic`). If one somehow exists, the nodes inside it keep
    wave 1 rather than looping forever — degraded, not hung.
    """
    status_of = {tid: status for tid, status, _, _ in tasks}
    ids = list(status_of)
    edges = [(a, b) for a, b in edges if a in status_of and b in status_of]

    predecessors: dict[str, list[str]] = {tid: [] for tid in ids}
    successors: dict[str, list[str]] = {tid: [] for tid in ids}
    for src, dst in edges:
        predecessors[dst].append(src)
        successors[src].append(dst)

    order = _topological(ids, predecessors, successors)

    wave: dict[str, int] = dict.fromkeys(ids, 1)
    # Longest path *by count* — MVP's definition of critical, until tasks carry
    # an estimated duration (docs/for-developers/modules/work/spec.mda).
    longest: dict[str, int] = dict.fromkeys(ids, 1)
    came_from: dict[str, str | None] = dict.fromkeys(ids)
    for tid in order:
        for pred in predecessors[tid]:
            wave[tid] = max(wave[tid], wave[pred] + 1)
            if longest[pred] + 1 > longest[tid]:
                longest[tid] = longest[pred] + 1
                came_from[tid] = pred

    critical_path: list[str] = []
    if ids:
        tail = max(ids, key=lambda t: (longest[t], -order.index(t)))
        node: str | None = tail
        # `seen` is the guard, not an optimisation: a cycle makes `came_from`
        # circular, and walking it would spin forever. The write path rejects
        # cycles, so this only fires on data that got in another way — and it
        # must degrade, never hang.
        seen: set[str] = set()
        while node is not None and node not in seen:
            seen.add(node)
            critical_path.append(node)
            node = came_from[node]
        critical_path.reverse()
    # A "critical path" of one task is just a task; don't paint the whole
    # canvas green when nothing depends on anything.
    if len(critical_path) < 2:
        critical_path = []

    due_of = {tid: (due or _FAR_FUTURE, created) for tid, _, due, created in tasks}
    ranked = sorted(ids, key=lambda t: (wave[t], due_of[t][0], due_of[t][1], t))

    critical = set(critical_path)
    plan_tasks = [
        PlanTask(
            id=tid,
            wave=wave[tid],
            blocked_by=[p for p in predecessors[tid] if status_of[p] != TaskStatus.done.value],
            critical=tid in critical,
            order=i + 1,
        )
        for i, tid in enumerate(ranked)
    ]
    return DerivedPlan(tasks=plan_tasks, edges=edges, critical_path=critical_path)


def _topological(
    ids: list[str],
    predecessors: dict[str, list[str]],
    successors: dict[str, list[str]],
) -> list[str]:
    """Kahn's algorithm. Nodes left over (a cycle) are appended in id order so
    the caller degrades rather than hangs."""
    indegree = {tid: len(predecessors[tid]) for tid in ids}
    ready = sorted([tid for tid in ids if indegree[tid] == 0])
    out: list[str] = []
    while ready:
        tid = ready.pop(0)
        out.append(tid)
        for nxt in successors[tid]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                ready.append(nxt)
                ready.sort()
    if len(out) < len(ids):
        out.extend(sorted(set(ids) - set(out)))
    return out
