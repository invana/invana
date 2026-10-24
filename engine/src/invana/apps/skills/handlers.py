"""The handlers a skill's instructions declare, read from the text.

A skill's ``## When things go wrong`` section is its handlers: each line under
it says what to do when a step fails. Nothing draws them — they are read off
the text deterministically, so the Flow tab and the plan preview always show
what the document says, in its order.

A handler **guards the step it names**: the first plan node whose function —
its dotted ``task`` (``web.search``) or that name's last segment (``search``) —
appears in the line. A line that names no step's function guards none, and the
reader draws it under the plan's last step.

Usage::

    rows = handlers_of(version.content, plan.nodes)
    rows[0]  # {"span": "If web.search finds nothing, ask the person.", "step_id": "web_search"}
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from typing import Any

#: The heading that opens the section, any heading level, any case.
_HEADING = re.compile(r"^\s{0,3}#{1,6}\s+when things go wrong\s*#*\s*$", re.IGNORECASE)
#: Any heading of level one or two closes it.
_CLOSES = re.compile(r"^\s{0,3}#{1,2}\s")
#: A list marker or number in front of a line, which is not part of what it says.
_MARKER = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")


def _lines(content: str) -> list[str]:
    out: list[str] = []
    inside = False
    for raw in (content or "").splitlines():
        if _HEADING.match(raw):
            inside = True
            continue
        if inside and _CLOSES.match(raw):
            break
        if inside and raw.strip() and not raw.lstrip().startswith("#"):
            out.append(_MARKER.sub("", raw).strip())
    return [line for line in out if line]


def _names(task: str) -> list[str]:
    task = (task or "").strip()
    if not task:
        return []
    last = task.rsplit(".", 1)[-1]
    return [task] if last == task else [task, last]


def _mentions(line: str, name: str) -> bool:
    return re.search(rf"(?<![\w.]){re.escape(name)}(?![\w])", line, re.IGNORECASE) is not None


def handlers_of(content: str, nodes: Iterable[Mapping[str, Any]]) -> list[dict[str, str | None]]:
    """Each non-empty line under ``## When things go wrong``, with the step it guards.

    ``nodes`` are the plan's nodes in plan order, each with an ``id`` and a
    ``task``. A line's ``step_id`` is the first node whose dotted function, or
    that function's last segment, the line names as a whole word; else null.
    The full dotted name is tried across every node before any short one, so
    ``graph.read.query`` is not taken by a node whose function ends in ``read``.
    """
    steps = [(str(n.get("id")), str(n.get("task") or "")) for n in nodes]
    rows: list[dict[str, str | None]] = []
    for line in _lines(content):
        step_id = next((sid for sid, task in steps if task and _mentions(line, task)), None)
        if step_id is None:
            step_id = next(
                (sid for sid, task in steps for name in _names(task)[1:] if _mentions(line, name)),
                None,
            )
        rows.append({"span": line, "step_id": step_id})
    return rows
