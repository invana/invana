"""The executor — *where* a step runs
(docs/for-developers/modules/platform/features/runtime.md §2).

One protocol, one implementation: in-process asyncio. It grows a registry the
day someone actually swaps it, and not before.

Its whole job is to call one catalogue step and make sure a reachability
problem arrives as a diagnosis rather than a crashed run.
"""

from __future__ import annotations

from fastapi import HTTPException

from invana.runtime.catalogue import TASKS, RunVars, TaskContext, http_failure


async def _dispatch(task_key: str, ctx: TaskContext, v: RunVars):
    """Run one task, with connection/config errors landing as failures, not defects.

    Any task that reaches for the graph can raise ``HTTPException`` — a graph
    with no connection, or one that isn't active. Those are facts about the
    graph the reader can act on, so they must arrive as a diagnosis with a
    "Check the connection" route rather than as a crashed run reading
    "something went wrong inside the engine".
    """
    try:
        return await TASKS[task_key](ctx, v)
    except HTTPException as exc:
        raise http_failure(exc) from exc


# Prior turns replayed as NL context (docs/for-developers/modules/ask/spec.md) — same window as the old path.
