"""What changed between two versions of a library plan
([LB37](docs/for-developers/modules/workflows/features/the-library.md)).

A published version is immutable, so *what changed* is a fact about two
records: computed here, once, and never again in Studio. Steps match on their
``key`` — a rename is a removal and an addition, because a new key is a new
step. Pure: it reads two sets of rows and two ``args_schema`` and touches
nothing.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from invana.apps.task_plans.models import Task
from invana.apps.task_plans.schemas import ArgumentChange, FieldChange, StepChange


def _after(task: Task) -> list[str]:
    """What the step waits on — the keys, in a stable order."""
    return sorted({d["key"] for d in task.depends_on or [] if isinstance(d, dict) and "key" in d})


def _fields(before: Task, after: Task) -> list[FieldChange]:
    out: list[FieldChange] = []
    for field, old, new in (
        ("task", before.step_key, after.step_key),
        ("form", before.form, after.form),
        ("after", _after(before), _after(after)),
    ):
        if old != new:
            out.append(FieldChange(field=field, before=old, after=new))
    old_args, new_args = dict(before.args or {}), dict(after.args or {})
    for name in sorted(old_args.keys() | new_args.keys()):
        if old_args.get(name) != new_args.get(name):
            out.append(FieldChange(field=f"args.{name}", before=old_args.get(name), after=new_args.get(name)))
    return out


def diff_steps(
    before: Sequence[Task], after: Sequence[Task]
) -> tuple[list[str], list[str], list[str], list[StepChange], list[str]]:
    """``added · removed · moved · changed · unchanged``, each in the newer
    version's order (``removed`` in the older one's)."""
    old = {t.key: t for t in sorted(before, key=lambda t: t.ordinal)}
    new = {t.key: t for t in sorted(after, key=lambda t: t.ordinal)}
    added = [k for k in new if k not in old]
    removed = [k for k in old if k not in new]
    # A step moved when its place among the steps both versions share moved —
    # an insertion before it is an addition, not a move of everything after.
    shared_old = [k for k in old if k in new]
    shared_new = [k for k in new if k in old]
    moved = [k for i, k in enumerate(shared_new) if shared_old[i] != k]
    changed: list[StepChange] = []
    unchanged: list[str] = []
    for key in shared_new:
        fields = _fields(old[key], new[key])
        if fields:
            changed.append(StepChange(step_key=key, fields=fields))
        elif key not in moved:
            unchanged.append(key)
    return added, removed, moved, changed, unchanged


def diff_arguments(before: dict[str, Any], after: dict[str, Any]) -> list[ArgumentChange]:
    """The arguments the plan declares — a caller tunes these (LB19)."""
    out: list[ArgumentChange] = []
    for name in sorted(before.keys() | after.keys()):
        old, new = before.get(name), after.get(name)
        if old == new:
            continue
        change = "added" if old is None else "removed" if new is None else "changed"
        out.append(ArgumentChange(name=name, change=change, before=old, after=new))
    return out


def summarise(
    added: list[str],
    removed: list[str],
    moved: list[str],
    changed: list[StepChange],
    arguments: list[ArgumentChange],
) -> str:
    """The one line the drawer's Versions band prints — ``+await_reply ·
    execute_graph_query changed``."""
    parts = [f"+{k}" for k in added] + [f"\N{MINUS SIGN}{k}" for k in removed]
    parts += [f"{c.step_key} changed" for c in changed]
    parts += [f"{k} moved" for k in moved if k not in {c.step_key for c in changed}]
    parts += [f"argument {a.name} {a.change}" for a in arguments]
    return " · ".join(parts) if parts else "the same steps"
