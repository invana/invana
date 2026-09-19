"""Every attribute the interpreter writes on a run is a real column.

The M3 trap, in its quieter form. M3 renamed the run's frozen plan to
``plan_snapshot`` — *"**Not `plan`** — that word names four things"* — and two
sites kept the old name. Python let both through:

- ``th.plan = payload`` set an instance attribute SQLAlchemy never persists, so
  every run since M3 recorded ``plan_origin`` and lost the document it names.
  Nothing raised, nothing logged, and 40 root runs carried 3 snapshots.
- ``TaskRun.plan.isnot(None)`` raises ``AttributeError`` — but only on the
  promotable-candidates path, which no test walked.

A column whose meaning moved is the one thing a rename pass cannot be trusted
with, so this asserts the mapping rather than the behaviour: it fails on the
next one before it reaches a database.
"""

from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy import inspect

from invana.runtime.models import TaskRun

_LOOP = Path(__file__).resolve().parents[2] / "src" / "invana" / "runtime" / "interpreter" / "loop.py"
_ASSIGNED = re.compile(r"\bth\.([a-z_][a-z0-9_]*)\s*=(?!=)")


def _mapped() -> set[str]:
    return {attr.key for attr in inspect(TaskRun).attrs}


def test_the_interpreter_only_writes_columns_that_exist() -> None:
    """`th` is the run throughout the loop, so every attribute set on it must map."""
    written = set(_ASSIGNED.findall(_LOOP.read_text()))
    assert written, "expected the loop to write to the run; the variable may have been renamed"
    assert written <= _mapped(), f"written but not mapped: {sorted(written - _mapped())}"


def test_the_frozen_plan_is_named_plan_snapshot() -> None:
    """The word `plan` names four things, so the column is not one of them."""
    mapped = _mapped()
    assert "plan_snapshot" in mapped
    assert "plan" not in mapped
