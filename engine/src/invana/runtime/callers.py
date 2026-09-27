"""Who a run asks the graph for — read off the run, never guessed (the-model-page.md MP35).

A canvas run is the **Explorer**; a query sent in a query language is the
**API**, whichever agent carried it; any other run with an agent, or a question
in language, is an **agent**; any other library plan is a **plan**. The builtins that write data and the
platform's own runs ask for no one, so their queries are not logged — what
they did is Growth's to show, not Usage's.

A delegated node asks for whoever its root run asked for.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from invana.core.querylog import QueryCaller
from invana.runtime.models import TriggeredBy
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.services import (
    BULK_PLAN_KEY,
    LOAD_PLAN_KEY,
    STITCH_COMMIT_PLAN_KEY,
    STITCH_WITHDRAW_PLAN_KEY,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.runtime.models import TaskRun

#: Plans whose queries are writes, not questions.
_UNLOGGED_PLANS = frozenset({LOAD_PLAN_KEY, BULK_PLAN_KEY, STITCH_COMMIT_PLAN_KEY, STITCH_WITHDRAW_PLAN_KEY})
_ROOT_HOPS = 16


async def caller_for(db: AsyncSession, run: TaskRun) -> QueryCaller | None:
    root = run
    for _ in range(_ROOT_HOPS):
        if not root.parent_run_id:
            break
        parent = await TaskRunQuerySet().get(db, root.parent_run_id)
        if parent is None:
            break
        root = parent
    return classify(root)


def classify(root: TaskRun) -> QueryCaller | None:
    plan_key = (root.workflow_key or "").split("@")[0]
    if root.triggered_by == TriggeredBy.system.value or plan_key in _UNLOGGED_PLANS:
        return None
    if root.triggered_by == TriggeredBy.canvas.value:
        kind, caller_id = "explorer", root.author_id
    elif root.ask_kind == "ql":
        # Read before the agent: every session binds one, but a typed query is
        # the person's, and the agent only carried it.
        kind, caller_id = "api", root.author_id
    elif root.agent_id or root.ask_kind == "nl":
        kind, caller_id = "agent", root.agent_id or root.author_id
    else:
        kind, caller_id = "plan", plan_key or None
    return QueryCaller(graph_id=root.graph_id, kind=kind, caller_id=caller_id, task_run_id=root.id)
