"""Grounding a clarification's options in the graph.

A model that asks back may propose an ``options_query`` instead of a fixed list
(docs/for-developers/modules/ask/features/clarifying-questions.md). Running it is
what makes the difference between *pick one of these* and *pick one of these,
probably* — the options come from the graph rather than from the model.

**This read is inside the run and under its lens**
([CQ11](docs/for-developers/modules/ask/features/clarifying-questions.md)). The
``llm`` entry that asks back opens the run's ``graph_data`` crossing around it,
hands the lens here, and records the touch — so a world that excludes a value
never offers it. The model wrote the query and no ``validate_query`` stands in
front of it, so the read-only check is made here; anything refused or failed
falls back to the fixed options.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.graphs.pool import GraphConnectionManager
from invana.apps.graphs.query_service import QueryExecutionError, execute_query
from invana.apps.graphs.schemas import QueryResponse
from invana.apps.llm.translate import _looks_read_only
from invana.graph.connectors.base.exceptions import LensViolationError
from invana.graph.types.lens import QueryLens


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
    language: str,
    lens: QueryLens | None,
) -> tuple[list[str], QueryResponse | None]:
    """Resolve ``options_query`` into real choices under *lens*, or keep the fixed ones.

    Returns the choices and the result they came from — ``None`` when nothing
    was read, so the caller records a touch only for a read that happened.

    A query that writes, that the lens refuses, or that fails is not an error the
    person should see: the clarification still has its question, and the fixed
    options — or none at all — are a worse answer than the graph's, not a
    broken one.
    """
    if not options_query or not _looks_read_only(options_query, language):
        return list(fallback), None
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
            lens=lens,
        )
    except (QueryExecutionError, HTTPException, LensViolationError):
        return list(fallback), None
    return option_values(result) or list(fallback), result
