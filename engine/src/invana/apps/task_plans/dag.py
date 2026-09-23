"""The DAG a plan describes, and who pins what on it.

Pure — no session, no rules about who may do anything. An algorithm, so it keeps
its own name rather than a role's (migration-plan §4.1).

**Two functions, and the difference between them is the whole of M2.**

:func:`materialise` is the *one-time* conversion: it reads an authored step list
and decides each node's predecessors. :func:`dag_for` is the *read path*: it
takes Task rows whose ``depends_on`` is already written down and draws them.

Deriving the order on every read is how a plan ends up carrying an edge nobody
meant — the sequence fallback below is a guess, and a guess re-made on every
read is never reviewed. Materialising it makes it a fact somebody can look at,
which is why every materialised edge records *why* it is there.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

from invana.apps.agents.models import Agent
from invana.apps.task_plans.models import Task, TaskPlan

# `${steps.<step>.<field>}` — a step arg that reads an earlier step's output.
_BINDING = re.compile(r"^\$\{steps\.([A-Za-z0-9_]+)\.([A-Za-z0-9_.]+)\}$")

#: Why one node waits for another.
#:
#: ``binding``   its output feeds this node's args — the strongest claim.
#: ``require``   the catalogue entry declares it (`execute` after `validate`).
#: ``sequence``  neither of the above: the fallback, and the one to review.
EDGE_KINDS = ("binding", "require", "sequence")


def materialise(
    steps: Sequence[Mapping[str, Any]], *, requires: Mapping[str, tuple[str, ...]] | None = None
) -> list[dict]:
    """Explode an authored step list into Task rows with explicit ``depends_on``.

    **The picture is the partial order, not the list.** A spec is written as an
    ordered list because it has to be written down in some order — but "runs at
    index 4" is not the same claim as "must run after index 3", and treating
    the list as a chain asserts the second. On ``nl-compare`` that chain would
    say *Translate B requires Execute A*, which is false: the two readings of
    the graph are independent.

    So a node's predecessors come from what actually constrains it:

    ``${steps.X.y}`` bindings
        X's output feeds this node — recorded as ``binding``.
    ``requires`` on the catalogue entry
        `execute_graph_query` after `validate_query`, resolved to **every open
        branch** running that step so branch A's execute takes branch A's
        validate, while *Project* — which summarises both readings — takes
        both. Recorded as ``require``.
    the sequence, as a fallback
        A node that binds nothing and requires nothing still has to come after
        the work it summarises — *Project* and *Verify* are the cases. It joins
        every current **sink**, which is what makes two branches converge
        rather than dangle. Recorded as ``sequence``, and **that label is the
        point**: it is the guess, and it is now reviewable.

    The one exception to the fallback: a dependency-free node whose step has
    already appeared is a **new branch**, not a continuation (Translate B). It
    is a root, and the plan forks the way it actually does.

    Returns one dict per node, ready to write as a :class:`Task` row.
    """
    rows = [
        {
            "key": str(s.get("id") or s.get("task")),
            "step_key": str(s.get("task") or ""),
            "title": str(s.get("label") or s.get("task") or ""),
            "args": dict(s.get("args") or {}),
            "ordinal": index,
            "depends_on": [],
        }
        for index, s in enumerate(steps)
    ]

    seen_steps: set[str] = set()
    # Keys already placed, and the ones something else already runs after —
    # their difference is the frontier a fallback node joins to.
    placed: list[str] = []
    has_successor: set[str] = set()

    for index, row in enumerate(rows):
        deps: dict[str, str] = {}

        for value in row["args"].values():
            if not isinstance(value, str):
                continue
            match = _BINDING.match(value)
            if match and match.group(1) in placed:
                deps[match.group(1)] = "binding"

        sinks = [p for p in placed if p not in has_successor]
        for required in (requires or {}).get(row["step_key"], ()):
            priors = [p for p in sinks if _step_of(rows, p) == required] or [
                _nearest_before(rows, index, step_key=required)
            ]
            for prior in priors:
                if prior and prior not in deps:
                    deps[prior] = "require"

        if not deps and index and row["step_key"] not in seen_steps:
            for sink in sinks:
                deps[sink] = "sequence"

        row["depends_on"] = [{"key": key, "kind": kind} for key, kind in deps.items()]
        for key in deps:
            has_successor.add(key)

        seen_steps.add(row["step_key"])
        placed.append(row["key"])

    return rows


def dag_for(tasks: Sequence[Task]) -> tuple[list[dict], list[dict]]:
    """Nodes and edges for the ``plan`` canvas kind, from **rows**.

    Nothing is inferred here: ``depends_on`` was decided once, by
    :func:`materialise`, and this reads it back. The only thing computed is
    ``depth`` — the longest path from a root — which the canvas lays out as a
    node's column, and a binding's label, which is a presentation detail read
    off the args the edge already points at.
    """
    ordered = sorted(tasks, key=lambda t: (t.ordinal, t.key))
    nodes = [
        {
            "id": t.key,
            "task": t.step_key or "",
            "label": t.title or t.key,
            "args": dict(t.args or {}),
            # `callable · composite · human`. The band a node draws in is read
            # off this and the step key together (:mod:`invana.runtime.layers`),
            # and the form is the half a person is not a bound.
            "form": t.form,
            "depth": 0,
        }
        for t in ordered
    ]
    by_key = {n["id"]: n for n in nodes}
    edges: list[dict] = []

    for task in ordered:
        node = by_key.get(task.key)
        if node is None:
            continue
        for dep in task.depends_on or []:
            source = dep.get("key") if isinstance(dep, dict) else str(dep)
            kind = dep.get("kind", "sequence") if isinstance(dep, dict) else "sequence"
            if source not in by_key:
                continue
            edges.append(
                {
                    "source": source,
                    "target": task.key,
                    # The canvas draws a binding dashed and an order edge solid,
                    # so it needs the two apart; `require` and `sequence` are
                    # both order, and the label is what tells them apart.
                    "kind": "binding" if kind == "binding" else "order",
                    "label": _label_for(kind, source, dict(task.args or {})),
                }
            )
            node["depth"] = max(node["depth"], by_key[source]["depth"] + 1)

    return nodes, edges


def _label_for(kind: str, source: str, args: Mapping[str, Any]) -> str:
    if kind == "require":
        return "require"
    if kind != "binding":
        return ""
    for arg, value in args.items():
        if not isinstance(value, str):
            continue
        match = _BINDING.match(value)
        if match and match.group(1) == source:
            field = match.group(2)
            # `query → query` says nothing twice; when the field keeps its name
            # across the binding, the name is the whole label.
            return field if field == arg else f"{field} → {arg}"
    return ""


def _nearest_before(rows: list[dict], index: int, *, step_key: str) -> str | None:
    """The closest earlier node running ``step_key`` — branch A's, not branch B's."""
    for row in reversed(rows[:index]):
        if row["step_key"] == step_key:
            return str(row["key"])
    return None


def _step_of(rows: list[dict], key: str) -> str:
    for row in rows:
        if row["key"] == key:
            return str(row["step_key"])
    return ""


def pinned_by(plan: TaskPlan, agents: list[Agent]) -> dict[str, dict[str, Any]]:
    """Which agents pin an arg on each task of this plan.

    Returned per task rather than per plan because that is the granularity the
    question is asked at — and returned as a **list of agents** so the UI can
    render a count and chips, never a singular claim that would be false the
    moment two agents pin the same thing
    (docs/for-developers/modules/explore/features/selection-and-the-panel.md-D3).
    """
    out: dict[str, dict[str, Any]] = {}
    for agent in agents:
        pins = (agent.workflow_spec or {}).get("pins") or {}
        for task, args in pins.items():
            if not isinstance(args, dict) or not args:
                continue
            entry = out.setdefault(task, {"args": set(), "agents": []})
            entry["args"].update(args)
            entry["agents"].append(agent)
    return out
