"""Queries behind Approvals: the Waiting queue and the alert rules
(docs/for-developers/modules/operate/features/approvals.md).

:class:`WaitingQuerySet` cuts the Waiting tabs — *For you*, *All*, *Answered* —
on the list contract and counts them; :class:`AlertRuleQuerySet` holds the
rules over the ledger and the window reads the clock evaluates them with.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Text, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.models import AlertRule, Approval, ApprovalStatus
from invana.activity.querysets.asks import still_waiting
from invana.core.auth.models import User
from invana.core.ledger.models import LedgerRow
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select
from invana.runtime.models import TaskRun

_ANSWERED = (ApprovalStatus.approved.value, ApprovalStatus.declined.value, ApprovalStatus.expired.value)


def _names(user_id: str):
    """``approver_ids`` names ``user_id`` — JSON matched as text on the quoted id."""
    return cast(Approval.approver_ids, Text).like(f'%"{user_id}"%')


class WaitingQuerySet:
    """The Approvals list, by tab, and the counts on the tabs."""

    async def page(
        self, session: AsyncSession, *, graph_id: str, params: ListParams, reader_id: str
    ) -> tuple[Sequence[Approval], PageInfo]:
        """One page of the Graph's approvals.

        ``view=for_you`` is pending and names the reader; ``all`` is pending;
        ``answered`` is decided or expired, newest decided first. ``mine`` keeps
        the bell tray's reading — approvals that name the reader, any status.
        Pending leaves out an ask whose run has ended: it is no longer waiting.
        """
        unfiltered = select(Approval).where(Approval.graph_id == graph_id)
        stmt = unfiltered
        sort_column = Approval.created_at
        view = params.one("view")
        if view == "for_you":
            stmt = stmt.where(still_waiting(), _names(reader_id))
        elif view == "all":
            stmt = stmt.where(still_waiting())
        elif view == "answered":
            stmt = stmt.where(Approval.status.in_(_ANSWERED), Approval.decided_at.is_not(None))
            sort_column = Approval.decided_at
        if params.one("mine"):
            stmt = stmt.where(_names(reader_id))
        if statuses := params.values("status"):
            stmt = stmt.where(Approval.status.in_(statuses))
        if kinds := params.values("kind"):
            stmt = stmt.where(Approval.kind.in_(kinds))
        if run_ids := params.values("run_id"):
            stmt = stmt.where(Approval.run_id.in_(run_ids))
        if params.q:
            stmt = stmt.where(contains(params.q, Approval.title))
        return await page_of_select(
            session, stmt, params, unfiltered=unfiltered, sorts={"created_at": sort_column}, id_column=Approval.id
        )

    async def counts(self, session: AsyncSession, *, graph_id: str, reader_id: str) -> tuple[int, int]:
        """(pending that name the reader, pending in the Graph)."""
        pending = still_waiting()
        stmt = select(func.count().filter(_names(reader_id)), func.count()).where(
            Approval.graph_id == graph_id, pending
        )
        for_you, every = (await session.execute(stmt)).one()
        return int(for_you or 0), int(every or 0)

    async def usernames(self, session: AsyncSession, ids: list[str]) -> dict[str, str]:
        """Usernames by id — a member who left the Graph still has one."""
        if not ids:
            return {}
        result = await session.execute(select(User.id, User.username).where(User.id.in_(ids)))
        return dict(result.all())

    async def run_numbers(self, session: AsyncSession, run_ids: list[str]) -> dict[str, int]:
        """Each run's number — a step's, or a delegated run's, is its root run's.

        Walked up a level at a time for every run at once, so a child under a
        delegate step under the root costs three queries, not three per run.
        """
        out: dict[str, int] = {}
        at = {run_id: run_id for run_id in run_ids}  # the run asked for → where its walk is
        for _ in range(16):
            if not at:
                break
            stmt = select(TaskRun.id, TaskRun.parent_run_id, TaskRun.number).where(TaskRun.id.in_(set(at.values())))
            rows = {rid: (parent, number) for rid, parent, number in (await session.execute(stmt)).all()}
            nxt: dict[str, str] = {}
            for asked, here in at.items():
                parent, number = rows.get(here, (None, None))
                if number is not None:
                    out[asked] = number
                elif parent is not None:
                    nxt[asked] = parent
            at = nxt
        return out


class AlertRuleQuerySet:
    """Alert rules, and the ledger rows the clock matches them against."""

    async def page(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[Sequence[AlertRule], PageInfo]:
        """One page of the Graph's rules, by name; ``q`` matches the name."""
        unfiltered = select(AlertRule).where(AlertRule.graph_id == graph_id)
        stmt = unfiltered
        if enabled := params.one("enabled"):
            stmt = stmt.where(AlertRule.enabled.is_(enabled == "true"))
        if params.q:
            stmt = stmt.where(contains(params.q, AlertRule.name))
        return await page_of_select(
            session, stmt, params, unfiltered=unfiltered, sorts={"name": AlertRule.name}, id_column=AlertRule.id
        )

    async def get(self, session: AsyncSession, *, graph_id: str, rule_id: str) -> AlertRule | None:
        row = await session.get(AlertRule, rule_id)
        return row if row is not None and row.graph_id == graph_id else None

    async def by_name(self, session: AsyncSession, *, graph_id: str, name: str) -> AlertRule | None:
        stmt = select(AlertRule).where(AlertRule.graph_id == graph_id, AlertRule.name == name)
        return (await session.execute(stmt)).scalars().first()

    async def add(self, session: AsyncSession, row: AlertRule) -> AlertRule:
        session.add(row)
        await session.flush()
        return row

    async def delete(self, session: AsyncSession, row: AlertRule) -> None:
        await session.delete(row)
        await session.flush()

    async def enabled_locked(self, session: AsyncSession) -> list[AlertRule]:
        """Every enabled rule, locked so two engine processes never fire one twice."""
        stmt = select(AlertRule).where(AlertRule.enabled.is_(True)).with_for_update(skip_locked=True)
        return list((await session.execute(stmt)).scalars().all())

    async def head_seq(self, session: AsyncSession, *, graph_id: str) -> int:
        stmt = select(func.max(LedgerRow.seq)).where(LedgerRow.graph_id == graph_id)
        return int((await session.execute(stmt)).scalar_one() or 0)

    async def rows_after(self, session: AsyncSession, *, graph_id: str, seq: int, limit: int = 5000) -> list[LedgerRow]:
        stmt = (
            select(LedgerRow)
            .where(LedgerRow.graph_id == graph_id, LedgerRow.seq > seq)
            .order_by(LedgerRow.seq)
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def rows_since(
        self, session: AsyncSession, *, graph_id: str, since: datetime, through_seq: int
    ) -> list[LedgerRow]:
        """The Graph's rows written at or after ``since``, up to ``through_seq``."""
        stmt = select(LedgerRow).where(
            LedgerRow.graph_id == graph_id, LedgerRow.at >= since, LedgerRow.seq <= through_seq
        )
        return list((await session.execute(stmt)).scalars().all())
