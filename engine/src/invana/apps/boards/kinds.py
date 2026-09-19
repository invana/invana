"""The board kind registry (docs/for-developers/building-engine/boards-migration.md § 5).

``kind`` is **one flat axis**. Whether a board is *drawn* or *declared* is
``renders`` — a property of the kind, declared once here, next to the other
per-kind traits. Two columns would make ``kind=canvas, subject=run``
representable and meaningless; one column makes it unrepresentable (B3).

Studio mirrors this table in ``boardKinds.ts``; the enum in
``tests/golden/openapi.json`` is what keeps the two honest.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Renders = Literal["canvas", "dashboard"]


@dataclass(frozen=True, slots=True)
class BoardKindSpec:
    kind: str
    #: Which body draws it. The **only** thing the page host branches on.
    renders: Renders
    #: Whether ``subject_id`` is required — for a declared kind it is the whole
    #: identity, so it always is.
    subject_required: bool
    #: What ``subject_id`` names, in one phrase. Documentation, not validation:
    #: it points at three tables by kind, so it is never a foreign key (B8).
    subject: str


def _drawn(kind: str, subject: str = "", *, required: bool = False) -> BoardKindSpec:
    return BoardKindSpec(kind=kind, renders="canvas", subject_required=required, subject=subject)


def _declared(kind: str, subject: str) -> BoardKindSpec:
    return BoardKindSpec(kind=kind, renders="dashboard", subject_required=True, subject=subject)


#: The whole axis. There is no ``dataset`` kind — records are imported *into a
#: model* and Dataset is a retired noun (terminology.md).
BOARD_KINDS: dict[str, BoardKindSpec] = {
    spec.kind: spec
    for spec in (
        _drawn("data"),
        _drawn("model"),
        _drawn("plan", "a task_plans.id", required=True),
        _drawn("workflow", "a task_plans.id", required=True),
        _drawn("envelope", "an agent id", required=True),
        _drawn("lineage", "a root task_runs.id", required=True),
        _declared("run", "a root task_runs.id"),
        _declared("task_run", "a child task_runs.id"),
        _declared("plan_runs", "a task_plans.id"),
    )
}

#: The literal the schemas validate against, so an unknown kind is a 422 rather
#: than a row nothing can render.
BoardKindName = Literal[
    "data",
    "model",
    "plan",
    "workflow",
    "envelope",
    "lineage",
    "run",
    "task_run",
    "plan_runs",
]

#: What a version records about why it was written. ``report`` is a declared
#: board's frozen reading (B11).
BoardVersionCause = Literal["query", "expand", "load", "manual", "report"]


def spec_for(kind: str) -> BoardKindSpec:
    """The registry row for ``kind``, or ``KeyError`` — callers validate first."""
    return BOARD_KINDS[kind]


def renders(kind: str) -> Renders:
    return BOARD_KINDS[kind].renders


def is_declared(kind: str) -> bool:
    return BOARD_KINDS[kind].renders == "dashboard"


DRAWN_KINDS = tuple(k for k, s in BOARD_KINDS.items() if s.renders == "canvas")
DECLARED_KINDS = tuple(k for k, s in BOARD_KINDS.items() if s.renders == "dashboard")
