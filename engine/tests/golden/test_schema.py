"""The schema guard: what the models declare, and what the migrations build.

The two are pinned separately because they already disagree (server defaults,
a few indexes and constraints — docs/for-developers/building-engine/refactor-plan.md §7).
Each guard catches a change to its own side; neither asks them to agree.
"""

from __future__ import annotations

import difflib
from pathlib import Path

from tests.golden.snapshots import MIGRATED_DDL_FILE, MODELS_DDL_FILE, migrated_ddl, models_ddl


def _assert_matches(golden: Path, actual: str, label: str) -> None:
    expected = golden.read_text()
    if actual != expected:
        diff = "".join(
            difflib.unified_diff(
                expected.splitlines(keepends=True),
                actual.splitlines(keepends=True),
                fromfile=str(golden),
                tofile=label,
                n=2,
            )
        )
        raise AssertionError(f"{label} changed:\n{diff}")


def test_models_ddl_matches_golden() -> None:
    _assert_matches(MODELS_DDL_FILE, models_ddl(), "Base.metadata DDL")


def test_migrated_ddl_matches_golden() -> None:
    """``alembic upgrade head`` on an empty Postgres database, then reflect it."""
    _assert_matches(MIGRATED_DDL_FILE, migrated_ddl(), "migrated schema DDL")
