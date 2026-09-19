"""Render a plan as YAML.

A tiny emitter rather than a dependency: the plan grammar is dicts, lists,
strings, numbers and booleans, and nothing else can appear in it — the validator
sees to that.

**YAML is the authoring format, never a second source of truth**
(task-model-migration §2.2). The rows are the plan; this renders them back. That
is why :func:`steps_of` exists and is tested against the step list a plan was
seeded from: exploding a spec into rows has to be lossless, or the export is a
different document from the one that was authored.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from invana.apps.task_plans.models import Task, TaskPlan


def steps_of(tasks: Sequence[Task]) -> list[dict]:
    """The authored step list, rebuilt from rows.

    The inverse of :func:`invana.apps.task_plans.dag.materialise` as far as the
    *document* is concerned: ``depends_on`` is not emitted, because it was
    derived from the args and the catalogue in the first place and writing it
    back would make the export say twice what it once said once.
    """
    out: list[dict] = []
    for task in sorted(tasks, key=lambda t: (t.ordinal, t.key)):
        step: dict[str, Any] = {"id": task.key, "task": task.step_key or "", "label": task.title or task.key}
        step["args"] = dict(task.args or {})
        for name, value in (
            ("when", task.when),
            ("map_over", task.map_over),
            ("loop", task.loop),
            ("approval", task.approval),
            ("timeout_s", task.timeout_s),
            ("retry", task.retry),
            ("pool", task.pool),
            ("max_parallel", task.max_parallel),
            ("on_lane_failure", task.on_lane_failure),
        ):
            if value is not None:
                step[name] = value
        out.append(step)
    return out


def to_yaml(plan: TaskPlan, tasks: Sequence[Task]) -> str:
    doc = {
        "key": plan.key,
        "version": plan.version,
        "description": plan.description,
        "kind": plan.kind,
        "origin": plan.origin,
        "intent": list(plan.intent or []),
        "steps": steps_of(tasks),
    }
    return _emit(doc, 0).rstrip() + "\n"


def _emit(value: Any, indent: int) -> str:
    pad = "  " * indent
    if isinstance(value, dict):
        if not value:
            return f"{pad}{{}}\n"
        out = ""
        for key, item in value.items():
            if isinstance(item, dict | list) and item:
                out += f"{pad}{key}:\n{_emit(item, indent + 1)}"
            else:
                out += f"{pad}{key}: {_scalar(item)}\n"
        return out
    if isinstance(value, list):
        if not value:
            return f"{pad}[]\n"
        out = ""
        for item in value:
            if isinstance(item, dict):
                body = _emit(item, indent + 1)
                # First line of the mapping carries the dash.
                first, _, rest = body.partition("\n")
                out += f"{pad}- {first.strip()}\n" + (rest if rest else "")
            else:
                out += f"{pad}- {_scalar(item)}\n"
        return out
    return f"{pad}{_scalar(value)}\n"


def _scalar(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int | float):
        return str(value)
    text = str(value)
    if text == "" or any(c in text for c in ':#{}[]&*!|>%@`"\n') or text.strip() != text:
        return '"' + text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'
    return text
