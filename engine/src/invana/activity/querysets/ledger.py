"""Every query the ledger's read routes run (docs/for-developers/modules/operate/features/the-ledger.md).

Reads only: the one writer is ``invana.core.ledger.record``. Every statement
starts from :meth:`LedgerReadQuerySet.scope` — the Graph's rows, narrowed to
what the reader may see when the reader is not an admin — and adds the Rows
filters with :meth:`LedgerReadQuerySet.filtered`. ``hidden`` is the same
filters counted without the narrowing, minus what the reader sees.

A member sees their own acts and the rows of runs they can open. A run opens
for a member when it belongs to no session, or to a session that member
started — the rule the run routes apply.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Select, Text, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from invana.activity.models import Approval, ApprovalStatus
from invana.apps.sessions.models import Session
from invana.core.auth.models import User
from invana.core.ledger.models import LedgerCheck, LedgerExport, LedgerRow
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select
from invana.runtime.models import TaskRun

#: Rows a computed read walks at most, newest first.
READ_CAP = 20000


def like_pattern(glob: str) -> str:
    """A ``*`` glob as a LIKE pattern, with LIKE's own wildcards escaped."""
    escaped = glob.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return escaped.replace("*", "%")


def act_like(glob: str) -> ColumnElement[bool]:
    return LedgerRow.act.like(like_pattern(glob), escape="\\")


def chain_names(actor_id: str) -> ColumnElement[bool]:
    """The row's actor is ``actor_id``, or its chain names it.

    ``actor_chain`` is JSON, matched as text on the quoted id so one statement
    reads the same on SQLite and Postgres; ids are UUIDs, so the quoted id
    names nothing else.
    """
    return or_(
        LedgerRow.actor_user_id == actor_id,
        LedgerRow.actor_agent_id == actor_id,
        cast(LedgerRow.actor_chain, Text).like(f'%"{actor_id}"%'),
    )


#: The chips over the Rows table.
PRESETS: dict[str, ColumnElement[bool]] = {
    "refused": LedgerRow.verdict == "refused",
    "writes": act_like("graph.write.*"),
    "third_party": LedgerRow.layer == "web",
    "secrets": LedgerRow.layer == "secret",
    "granted": or_(act_like("access.grant*"), and_(LedgerRow.act == "approval.approve", LedgerRow.layer == "access")),
    "people": LedgerRow.actor_kind == "person",
}


class LedgerReadQuerySet:
    """Reads over ``ledger_rows``, ``ledger_checks`` and ``ledger_exports``."""

    # ── scope and filters ────────────────────────────────────────────────────

    def visible_to(self, graph_id: str, user_id: str) -> ColumnElement[bool]:
        """What a member may see: their own acts, and the rows of runs they can open."""
        runs = (
            select(TaskRun.id)
            .outerjoin(Session, Session.id == TaskRun.session_id)
            .where(
                TaskRun.graph_id == graph_id,
                or_(TaskRun.session_id.is_(None), Session.created_by_id == user_id),
            )
        )
        return or_(LedgerRow.actor_user_id == user_id, LedgerRow.run_id.in_(runs))

    def scope(self, graph_id: str, viewer_id: str | None) -> Select:
        """The Graph's rows; with ``viewer_id``, only what that member may see."""
        stmt = select(LedgerRow).where(LedgerRow.graph_id == graph_id)
        if viewer_id is not None:
            stmt = stmt.where(self.visible_to(graph_id, viewer_id))
        return stmt

    def filtered(self, stmt: Select, params: ListParams, *, since: datetime | None) -> Select:
        """``stmt`` with the Rows filters, ``q`` and the window applied."""
        if since is not None:
            stmt = stmt.where(LedgerRow.at >= since)
        if actor := params.one("actor"):
            stmt = stmt.where(chain_names(actor.split(":", 1)[-1]))
        if act := params.one("act"):
            stmt = stmt.where(act_like(act))
        if layers := params.values("layer"):
            stmt = stmt.where(LedgerRow.layer.in_(layers))
        if run_ids := params.values("run_id"):
            stmt = stmt.where(LedgerRow.run_id.in_(run_ids))
        if verdicts := params.values("verdict"):
            stmt = stmt.where(LedgerRow.verdict.in_(verdicts))
        if refused_by := params.values("refused_by"):
            stmt = stmt.where(LedgerRow.refused_by.in_(refused_by))
        if presets := params.values("preset"):
            stmt = stmt.where(or_(*(PRESETS[p] for p in presets)))
        if params.q:
            stmt = stmt.where(contains(params.q, LedgerRow.act, LedgerRow.touched))
        return stmt

    # ── the Rows tab ─────────────────────────────────────────────────────────

    async def page(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        viewer_id: str | None,
        params: ListParams,
        since: datetime | None,
    ) -> tuple[Sequence[LedgerRow], PageInfo]:
        unfiltered = self.scope(graph_id, viewer_id)
        stmt = self.filtered(unfiltered, params, since=since)
        return await page_of_select(
            session, stmt, params, unfiltered=unfiltered, sorts={"seq": LedgerRow.seq}, id_column=LedgerRow.id
        )

    async def rows(self, session: AsyncSession, stmt: Select, *, limit: int = READ_CAP) -> list[LedgerRow]:
        """The rows ``stmt`` selects, newest first, at most ``limit``."""
        return list((await session.execute(stmt.order_by(LedgerRow.seq.desc()).limit(limit))).scalars().all())

    async def count(self, session: AsyncSession, stmt: Select) -> int:
        sub = stmt.order_by(None).limit(None).subquery()
        return int((await session.execute(select(func.count()).select_from(sub))).scalar_one())

    async def hidden(
        self, session: AsyncSession, *, graph_id: str, viewer_id: str | None, params: ListParams, since: datetime | None
    ) -> int:
        """Rows in the same filters ``viewer_id`` may not see. Zero for an admin."""
        if viewer_id is None:
            return 0
        every = await self.count(session, self.filtered(self.scope(graph_id, None), params, since=since))
        seen = await self.count(session, self.filtered(self.scope(graph_id, viewer_id), params, since=since))
        return max(every - seen, 0)

    async def get(
        self, session: AsyncSession, *, graph_id: str, viewer_id: str | None, row_id: str
    ) -> LedgerRow | None:
        stmt = self.scope(graph_id, viewer_id).where(LedgerRow.id == row_id)
        return (await session.execute(stmt)).scalars().first()

    async def around(
        self, session: AsyncSession, *, row: LedgerRow, viewer_id: str | None, span: int = 2
    ) -> list[LedgerRow]:
        """Up to ``span`` rows before and after ``row`` in its run, by ``seq``."""
        if row.run_id is None:
            return []
        base = self.scope(row.graph_id, viewer_id).where(LedgerRow.run_id == row.run_id)
        before = await session.execute(base.where(LedgerRow.seq < row.seq).order_by(LedgerRow.seq.desc()).limit(span))
        after = await session.execute(base.where(LedgerRow.seq > row.seq).order_by(LedgerRow.seq).limit(span))
        return [*reversed(list(before.scalars().all())), *after.scalars().all()]

    # ── tiles ────────────────────────────────────────────────────────────────

    async def tallies(self, session: AsyncSession, stmt: Select) -> dict[str, int]:
        """Counts over ``stmt``: acts, people and agents (distinct and their acts), refused, spawned."""
        sub = stmt.order_by(None).limit(None).subquery()
        person = sub.c.actor_kind == "person"
        agent = sub.c.actor_kind == "agent"
        row = (
            await session.execute(
                select(
                    func.count(),
                    func.count(func.distinct(sub.c.actor_user_id)).filter(person),
                    func.count().filter(person),
                    func.count(func.distinct(sub.c.actor_agent_id)).filter(agent),
                    func.count().filter(agent),
                    func.count().filter(sub.c.verdict == "refused"),
                    func.count().filter(and_(sub.c.act == "work.spawn_agent", sub.c.verdict == "allowed")),
                ).select_from(sub)
            )
        ).one()
        keys = ("acts", "people", "people_acts", "agents", "agent_acts", "refused", "spawned")
        return dict(zip(keys, (int(v or 0) for v in row), strict=True))

    async def refused_by(self, session: AsyncSession, stmt: Select) -> dict[str, int]:
        sub = stmt.where(LedgerRow.verdict == "refused").order_by(None).limit(None).subquery()
        result = await session.execute(
            select(sub.c.refused_by, func.count()).select_from(sub).group_by(sub.c.refused_by)
        )
        return {(key or "other"): int(n) for key, n in result.all()}

    # ── integrity and exports ────────────────────────────────────────────────

    async def check(self, session: AsyncSession, graph_id: str) -> LedgerCheck | None:
        return await session.get(LedgerCheck, graph_id)

    async def total(self, session: AsyncSession, graph_id: str) -> int:
        stmt = select(func.count()).select_from(LedgerRow).where(LedgerRow.graph_id == graph_id)
        return int((await session.execute(stmt)).scalar_one())

    async def add_export(self, session: AsyncSession, row: LedgerExport) -> LedgerExport:
        session.add(row)
        await session.flush()
        return row

    async def exports(self, session: AsyncSession, *, graph_id: str, limit: int = 100) -> list[LedgerExport]:
        stmt = (
            select(LedgerExport)
            .where(LedgerExport.graph_id == graph_id)
            .order_by(LedgerExport.created_at.desc(), LedgerExport.id.desc())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    # ── names ────────────────────────────────────────────────────────────────

    async def usernames(self, session: AsyncSession, ids: list[str]) -> dict[str, str]:
        if not ids:
            return {}
        result = await session.execute(select(User.id, User.username).where(User.id.in_(ids)))
        return dict(result.all())

    async def lens_snapshot(self, session: AsyncSession, run_id: str) -> dict | None:
        result = await session.execute(select(TaskRun.lens_snapshot).where(TaskRun.id == run_id))
        return result.scalars().first()

    async def approvals_waiting(self, session: AsyncSession, *, graph_id: str, user_id: str) -> int:
        """Pending approvals that name ``user_id`` as an approver."""
        stmt = (
            select(func.count())
            .select_from(Approval)
            .where(
                Approval.graph_id == graph_id,
                Approval.status == ApprovalStatus.pending.value,
                cast(Approval.approver_ids, Text).like(f'%"{user_id}"%'),
            )
        )
        return int((await session.execute(stmt)).scalar_one())
