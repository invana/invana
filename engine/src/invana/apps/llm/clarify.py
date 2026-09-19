"""Grounding a clarification's options in the graph.

A model that asks back may propose an ``options_query`` instead of a fixed list
(docs/for-developers/modules/ask/features/clarifying-questions.md). Running it is
what makes the difference between *pick one of these* and *pick one of these,
probably* — the options come from the graph rather than from the model.

**This read is not validated by the plan.** It happens inside an ``llm``-bounded
catalogue entry, on a query the model wrote, with no ``validate_query`` in front
of it. It is confined here on purpose: the values go to the person as options
and are never handed back to the model. It closes in **M5**, when a
clarification becomes its own ``graph_read`` node the validator can see
(docs/for-developers/building-engine/task-model-migration.md § 6.3).
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.graphs.pool import GraphConnectionManager
from invana.apps.graphs.query_service import QueryExecutionError, execute_query
from invana.apps.graphs.schemas import QueryResponse


def option_values(result: QueryResponse, limit: int = 10) -> list[str]:
    """First-column values of a tabular result — the picks for a clarification.

    De-duplicated, capped, order preserved.
    """
    out: list[str] = []
    for row in result.rows or []:
        value = next(iter(row.values()), None) if row else None
        text = str(value).strip() if value is not None else ""
        if text and text not in out:
            out.append(text)
        if len(out) >= limit:
            break
    return out


async def ground_options(
    db: AsyncSession,
    *,
    graph: Graph,
    manager: GraphConnectionManager,
    options_query: str | None,
    fallback: list[str],
    actor_id: str,
    session_id: str | None,
    timeout_s: float | None,
) -> list[str]:
    """Resolve ``options_query`` into real choices, or keep the fixed ones.

    A query that fails is not an error the person should see: the clarification
    still has its question, and the fixed options — or none at all — are a
    worse answer than the graph's, not a broken one.
    """
    if not options_query:
        return list(fallback)
    try:
        result = await execute_query(
            db,
            graph=graph,
            manager=manager,
            query=options_query,
            parameters=None,
            actor_id=actor_id,
            session_id=session_id,
            timeout_s=timeout_s,
        )
    except (QueryExecutionError, HTTPException):
        return list(fallback)
    return option_values(result) or list(fallback)
