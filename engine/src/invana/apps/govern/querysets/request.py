"""Queries against ``requests`` — the inbox of what the Graph could not serve.

Names a request reads as (the asker, the world, the model) are resolved here
too, in one query each, so a page of requests is a handful of reads rather than
one per row. An agent's name is not: ``agents`` sits above Govern, so the edge
resolves it and hands it in.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.models import Lens, Request, RequestStatus
from invana.apps.modeller.models import GraphModel
from invana.core.auth.models import User
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select


class RequestQuerySet:
    async def add(self, session: AsyncSession, request: Request) -> Request:
        session.add(request)
        await session.flush()
        return request

    async def get(self, session: AsyncSession, request_id: str) -> Request | None:
        return (await session.execute(select(Request).where(Request.id == request_id))).scalar_one_or_none()

    async def open_match(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        kind: str,
        title: str,
        asked_by_id: str | None,
        agent_id: str | None,
    ) -> Request | None:
        """The open request this ask repeats — same Graph, kind, asker and text."""
        stmt = select(Request).where(
            Request.graph_id == graph_id,
            Request.kind == kind,
            Request.status == RequestStatus.open.value,
            func.lower(Request.title) == title.strip().lower(),
            Request.asked_by_id.is_(None) if asked_by_id is None else Request.asked_by_id == asked_by_id,
            Request.agent_id.is_(None) if agent_id is None else Request.agent_id == agent_id,
        )
        return (await session.execute(stmt.order_by(Request.created_at))).scalars().first()

    async def page(self, session: AsyncSession, *, graph_id: str, params: ListParams) -> tuple[list[Request], PageInfo]:
        stmt = select(Request).where(Request.graph_id == graph_id)
        unfiltered = stmt
        if params.q:
            stmt = stmt.where(contains(params.q, Request.title, Request.blocked_by))
        if params.values("status"):
            stmt = stmt.where(Request.status.in_(params.values("status")))
        if params.values("kind"):
            stmt = stmt.where(Request.kind.in_(params.values("kind")))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"last_asked_at": Request.last_asked_at, "created_at": Request.created_at},
            id_column=Request.id,
        )

    async def open_count(self, session: AsyncSession, *, graph_id: str) -> int:
        stmt = select(func.count(Request.id)).where(
            Request.graph_id == graph_id, Request.status == RequestStatus.open.value
        )
        return int((await session.execute(stmt)).scalar_one())

    async def for_guardrail(self, session: AsyncSession, *, guardrail_id: str, limit: int) -> tuple[list[Request], int]:
        """The latest requests a guardrail filed, and how many it filed in all."""
        where = Request.guardrail_id == guardrail_id
        total = int((await session.execute(select(func.count(Request.id)).where(where))).scalar_one())
        rows = (
            (
                await session.execute(
                    select(Request).where(where).order_by(Request.last_asked_at.desc(), Request.id.desc()).limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), total

    async def refused_since(
        self, session: AsyncSession, *, guardrail_ids: list[str], since: datetime
    ) -> dict[str, int]:
        """``{guardrail id: requests asked since}`` — one grouped read for a whole list."""
        if not guardrail_ids:
            return {}
        stmt = (
            select(Request.guardrail_id, func.count(Request.id))
            .where(Request.guardrail_id.in_(guardrail_ids), Request.last_asked_at >= since)
            .group_by(Request.guardrail_id)
        )
        return {gid: int(n) for gid, n in (await session.execute(stmt)).all()}

    async def user_names(self, session: AsyncSession, ids: set[str]) -> dict[str, str]:
        """A person's display name by id — first and last, else the username."""
        ids = {i for i in ids if i}
        if not ids:
            return {}
        stmt = select(User.id, User.first_name, User.last_name, User.username).where(User.id.in_(ids))
        return {
            uid: " ".join(p for p in (first, last) if p) or username
            for uid, first, last, username in (await session.execute(stmt)).all()
        }

    async def lens_names(self, session: AsyncSession, ids: set[str]) -> dict[str, str]:
        ids = {i for i in ids if i}
        if not ids:
            return {}
        stmt = select(Lens.id, Lens.name).where(Lens.id.in_(ids))
        return {lid: name or "" for lid, name in (await session.execute(stmt)).all()}

    async def model_names(self, session: AsyncSession, ids: set[str]) -> dict[str, str]:
        ids = {i for i in ids if i}
        if not ids:
            return {}
        stmt = select(GraphModel.id, GraphModel.name).where(GraphModel.id.in_(ids))
        return dict((await session.execute(stmt)).all())

    async def model_by_ref(self, session: AsyncSession, *, graph_id: str, ref: str) -> GraphModel | None:
        """A model of this Graph by id or by name."""
        stmt = select(GraphModel).where(
            GraphModel.graph_id == graph_id, (GraphModel.id == ref) | (GraphModel.name == ref)
        )
        return (await session.execute(stmt)).scalars().first()

    async def model_in_graph(self, session: AsyncSession, *, graph_id: str, model_id: str) -> GraphModel | None:
        stmt = select(GraphModel).where(GraphModel.id == model_id, GraphModel.graph_id == graph_id)
        return (await session.execute(stmt)).scalar_one_or_none()
