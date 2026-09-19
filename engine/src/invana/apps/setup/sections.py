"""The setup checklist, written onto the Graph row.

Pure — no session (migration-plan §4.1). `apps/graphs` marks a section complete
as a side effect of a write, so this lives where both can reach it.
"""

from __future__ import annotations

from datetime import UTC, datetime

from invana.apps.graphs.models import Graph


def _mark_section(graph: Graph, section: str, action: str) -> None:
    """Mutate graph.setup_state to record a section action.

    ``action`` is ``complete`` | ``skip`` | ``reset``. A required section cannot be
    skipped (``SETUP_REQUIRED``) — the caller must validate first.

    Only a **skip** is stored (CM9). ``complete`` is kept because the instructions
    edit path still stamps a time worth showing on the timeline; whether a section
    is done is decided by :func:`derive_setup_state`, never by this column.
    """
    state = dict(graph.setup_state or {})
    now = datetime.now(UTC).isoformat()
    if action == "complete":
        state[section] = {"completed_at": now}
    elif action == "skip":
        state[section] = {"skipped_at": now}
    elif action == "reset":
        state.pop(section, None)
    graph.setup_state = state


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None
