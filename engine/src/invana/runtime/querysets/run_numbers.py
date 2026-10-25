"""The insert hook's read of a Graph's run numbers.

Kept apart from ``task_run`` so the hook in ``runtime.models`` reaches it
without importing what that queryset joins (flows), which would make every
app that reads run schemas depend on flows::

    last = last_run_number(connection, graph_id)
"""

from __future__ import annotations

from sqlalchemy import func, select

from invana.runtime.models import TaskRun


def last_run_number(connection, graph_id: str) -> int:
    """The highest root-run number in a Graph, on a sync connection (the insert hook's)."""
    stmt = select(func.coalesce(func.max(TaskRun.number), 0)).where(TaskRun.graph_id == graph_id)
    return int(connection.execute(stmt).scalar() or 0)
