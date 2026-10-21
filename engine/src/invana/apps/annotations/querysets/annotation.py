"""Queries against ``annotations`` and ``annotation_anchors``.

Scoped by graph. Who may see an annotation is a rule the manager states; the
queryset only takes the filters it is given.
"""

from __future__ import annotations

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.annotations.models import Annotation, AnnotationAnchor
from invana.core.auth.models import User


class AnnotationQuerySet:
    def _visible(
        self,
        *,
        graph_id: str,
        user_id: str,
        records: list[str] | None,
        session_id: str | None,
        scope: str,
    ) -> Select:
        stmt = select(Annotation).where(Annotation.graph_id == graph_id)
        # A session-only annotation is its writer's: the session is private.
        own_session = (Annotation.reach == "session") & (Annotation.created_by_id == user_id)
        if scope == "session":
            stmt = stmt.where(Annotation.session_id == session_id, or_(Annotation.reach == "graph", own_session))
        elif scope == "graph":
            seen = Annotation.reach == "graph"
            if session_id:
                seen = or_(seen, (Annotation.session_id == session_id) & own_session)
            stmt = stmt.where(seen)
        else:
            stmt = stmt.where(or_(Annotation.reach == "graph", own_session))
        if records:
            on_records = select(AnnotationAnchor.annotation_id).where(
                AnnotationAnchor.graph_id == graph_id, AnnotationAnchor.record_id.in_(records)
            )
            stmt = stmt.where(Annotation.id.in_(on_records))
        return stmt

    async def list_visible(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        user_id: str,
        records: list[str] | None,
        session_id: str | None,
        scope: str,
        limit: int,
        offset: int,
    ) -> list[Annotation]:
        stmt = self._visible(graph_id=graph_id, user_id=user_id, records=records, session_id=session_id, scope=scope)
        stmt = stmt.order_by(Annotation.created_at.asc(), Annotation.id.asc()).limit(limit).offset(offset)
        return list((await session.execute(stmt)).scalars().all())

    async def count_visible(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        user_id: str,
        records: list[str] | None,
        session_id: str | None,
        scope: str,
    ) -> int:
        inner = self._visible(graph_id=graph_id, user_id=user_id, records=records, session_id=session_id, scope=scope)
        stmt = select(func.count()).select_from(inner.subquery())
        return int((await session.execute(stmt)).scalar_one())

    async def get(self, session: AsyncSession, annotation_id: str) -> Annotation | None:
        stmt = select(Annotation).where(Annotation.id == annotation_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def names(self, session: AsyncSession, user_ids: set[str]) -> dict[str, str]:
        """Display names for the people who wrote, by id."""
        if not user_ids:
            return {}
        stmt = select(User.id, User.first_name, User.last_name, User.username).where(User.id.in_(user_ids))
        out: dict[str, str] = {}
        for uid, first, last, username in (await session.execute(stmt)).all():
            out[uid] = " ".join(p for p in (first, last) if p) or username
        return out

    async def add(self, session: AsyncSession, obj: Annotation) -> None:
        session.add(obj)
        await session.flush()

    async def delete(self, session: AsyncSession, obj: Annotation) -> None:
        await session.delete(obj)
