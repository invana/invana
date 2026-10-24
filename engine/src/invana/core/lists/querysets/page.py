"""The keyset page every SQL list is cut by.

A list's queryset builds two statements over one entity: ``stmt`` — scoped to
the Graph, with ``q`` and the filters applied by its own columns — and
``unfiltered`` — the same scope with no ``q`` and no filters. This module sorts
``stmt`` by the requested field then the id, resumes after the cursor, takes
``limit`` rows, and counts both statements.

Usage::

    stmt = select(Agent).where(Agent.graph_id == graph_id)
    unfiltered = stmt
    if params.q:
        stmt = stmt.where(contains(params.q, Agent.name, Agent.key))
    if params.values("status"):
        stmt = stmt.where(Agent.status.in_(params.values("status")))
    rows, info = await page_of_select(
        session, stmt, params, unfiltered=unfiltered,
        sorts={"name": Agent.name, "created_at": Agent.created_at}, id_column=Agent.id,
    )
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from invana.core.lists.params import ListParams, encode_cursor
from invana.core.lists.schemas import PageInfo


def contains(q: str, *columns: Any) -> ColumnElement[bool]:
    """Case-insensitive *contains* over any of ``columns`` — what ``q`` means on every list."""
    pattern = f"%{q.lower()}%"
    return or_(*(func.lower(c).like(pattern) for c in columns))


async def count_of(session: AsyncSession, stmt: Select) -> int:
    """How many rows ``stmt`` selects."""
    sub = stmt.order_by(None).limit(None).subquery()
    return int((await session.execute(select(func.count()).select_from(sub))).scalar_one())


async def page_of_select(
    session: AsyncSession,
    stmt: Select,
    params: ListParams,
    *,
    unfiltered: Select,
    sorts: Mapping[str, InstrumentedAttribute],
    id_column: InstrumentedAttribute,
) -> tuple[Sequence[Any], PageInfo]:
    """One page of ``stmt`` in ``params.sort`` order, with ``total`` and ``unfiltered_total``.

    ``sorts`` maps each sort field to a non-null column of the selected entity.
    """
    column = sorts[params.sort_key]
    total = await count_of(session, stmt)
    unfiltered_total = await count_of(session, unfiltered) if params.is_filtered else total

    after = params.after()
    if after is not None:
        value, row_id = after
        if params.descending:
            stmt = stmt.where(or_(column < value, and_(column == value, id_column < row_id)))
        else:
            stmt = stmt.where(or_(column > value, and_(column == value, id_column > row_id)))
    order = (column.desc(), id_column.desc()) if params.descending else (column.asc(), id_column.asc())
    rows = list((await session.execute(stmt.order_by(*order).limit(params.limit + 1))).scalars().all())

    next_cursor = None
    if len(rows) > params.limit:
        rows = rows[: params.limit]
        last = rows[-1]
        next_cursor = encode_cursor(params.sort, getattr(last, column.key), getattr(last, id_column.key))
    return rows, PageInfo(total=total, unfiltered_total=unfiltered_total, next_cursor=next_cursor)
