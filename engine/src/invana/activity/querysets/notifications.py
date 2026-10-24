"""Queries behind rules, channels, the inbox, deliveries and approvals
(docs/for-developers/modules/operate/features/notifications.md · approvals.md)."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Text, cast, func, or_, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.models import (
    Approval,
    ApprovalStatus,
    DeliveryStatus,
    Notification,
    NotificationChannel,
    NotificationCursor,
    NotificationDelivery,
    NotificationRule,
)
from invana.core.events.models import Event
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select
from invana.runtime.models import Emission


class ChannelQuerySet:
    async def get(self, session: AsyncSession, *, graph_id: str, channel_id: str) -> NotificationChannel | None:
        row = await session.get(NotificationChannel, channel_id)
        return row if row is not None and row.graph_id == graph_id else None

    async def by_ref(self, session: AsyncSession, *, graph_id: str, ref: str) -> NotificationChannel | None:
        stmt = select(NotificationChannel).where(
            NotificationChannel.graph_id == graph_id,
            or_(NotificationChannel.id == ref, NotificationChannel.name == ref),
        )
        return (await session.execute(stmt)).scalars().first()

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[NotificationChannel]:
        stmt = select(NotificationChannel).where(NotificationChannel.graph_id == graph_id)
        return list((await session.execute(stmt.order_by(NotificationChannel.name))).scalars())

    async def add(self, session: AsyncSession, row: NotificationChannel) -> NotificationChannel:
        session.add(row)
        await session.flush()
        return row

    async def delete(self, session: AsyncSession, row: NotificationChannel) -> None:
        await session.delete(row)
        await session.flush()


class RuleQuerySet:
    async def get(self, session: AsyncSession, *, graph_id: str, rule_id: str) -> NotificationRule | None:
        row = await session.get(NotificationRule, rule_id)
        return row if row is not None and row.graph_id == graph_id else None

    async def by_name(self, session: AsyncSession, *, graph_id: str, name: str) -> NotificationRule | None:
        stmt = select(NotificationRule).where(NotificationRule.graph_id == graph_id, NotificationRule.name == name)
        return (await session.execute(stmt)).scalars().first()

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[NotificationRule]:
        stmt = select(NotificationRule).where(NotificationRule.graph_id == graph_id)
        return list((await session.execute(stmt.order_by(NotificationRule.name))).scalars())

    async def enabled_for(self, session: AsyncSession, *, graph_ids: set[str]) -> list[NotificationRule]:
        stmt = select(NotificationRule).where(NotificationRule.graph_id.in_(graph_ids), NotificationRule.enabled)
        return list((await session.execute(stmt)).scalars())

    async def add(self, session: AsyncSession, row: NotificationRule) -> NotificationRule:
        session.add(row)
        await session.flush()
        return row

    async def delete(self, session: AsyncSession, row: NotificationRule) -> None:
        await session.delete(row)
        await session.flush()


class InboxQuerySet:
    async def add(self, session: AsyncSession, row: Notification) -> None:
        session.add(row)
        await session.flush()

    async def add_once(self, session: AsyncSession, values: dict) -> None:
        """Insert unless this person already has this event from this rule."""
        stmt = pg_insert(Notification).values(**values).on_conflict_do_nothing(constraint="uq_notification_event_rule")
        await session.execute(stmt)

    async def for_user(
        self, session: AsyncSession, *, graph_id: str, user_id: str, unread: bool, limit: int
    ) -> list[Notification]:
        stmt = select(Notification).where(Notification.graph_id == graph_id, Notification.user_id == user_id)
        if unread:
            stmt = stmt.where(Notification.read_at.is_(None))
        stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
        return list((await session.execute(stmt)).scalars())

    async def unread_count(self, session: AsyncSession, *, graph_id: str, user_id: str) -> int:
        stmt = select(func.count()).where(
            Notification.graph_id == graph_id, Notification.user_id == user_id, Notification.read_at.is_(None)
        )
        return int((await session.execute(stmt)).scalar_one())

    async def mark_read(
        self, session: AsyncSession, *, graph_id: str, user_id: str, ids: list[str] | None, now: datetime
    ) -> int:
        stmt = update(Notification).where(
            Notification.graph_id == graph_id, Notification.user_id == user_id, Notification.read_at.is_(None)
        )
        if ids is not None:
            stmt = stmt.where(Notification.id.in_(ids))
        result = await session.execute(stmt.values(read_at=now))
        return result.rowcount or 0


class DeliveryQuerySet:
    async def add(self, session: AsyncSession, row: NotificationDelivery) -> NotificationDelivery:
        session.add(row)
        await session.flush()
        return row

    async def add_once(self, session: AsyncSession, values: dict) -> None:
        stmt = (
            pg_insert(NotificationDelivery).values(**values).on_conflict_do_nothing(constraint="uq_delivery_event_rule")
        )
        await session.execute(stmt)

    async def pending(self, session: AsyncSession, *, limit: int = 50) -> list[NotificationDelivery]:
        stmt = (
            select(NotificationDelivery)
            .where(NotificationDelivery.status == DeliveryStatus.pending.value)
            .order_by(NotificationDelivery.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        return list((await session.execute(stmt)).scalars())

    async def for_approval(self, session: AsyncSession, *, approval_id: str) -> list[NotificationDelivery]:
        stmt = select(NotificationDelivery).where(NotificationDelivery.approval_id == approval_id)
        return list((await session.execute(stmt)).scalars())

    async def for_firing(self, session: AsyncSession, *, firing_id: str) -> list[NotificationDelivery]:
        stmt = select(NotificationDelivery).where(NotificationDelivery.firing_id == firing_id)
        return list((await session.execute(stmt)).scalars())

    async def channel(self, session: AsyncSession, *, channel_id: str | None) -> NotificationChannel | None:
        return await session.get(NotificationChannel, channel_id) if channel_id else None


class CursorQuerySet:
    async def take(self, session: AsyncSession, *, name: str) -> NotificationCursor | None:
        """The cursor row, locked; ``None`` while another process holds it or before it exists."""
        stmt = select(NotificationCursor).where(NotificationCursor.name == name).with_for_update(skip_locked=True)
        return (await session.execute(stmt)).scalars().first()

    async def create(self, session: AsyncSession, *, name: str, at: datetime) -> None:
        stmt = pg_insert(NotificationCursor).values(name=name, created_at=at, event_id="").on_conflict_do_nothing()
        await session.execute(stmt)

    async def events_after(self, session: AsyncSession, *, cursor: NotificationCursor, limit: int) -> list[Event]:
        stmt = (
            select(Event)
            .where(tuple_(Event.created_at, Event.id) > tuple_(cursor.created_at, cursor.event_id))
            .order_by(Event.created_at, Event.id)
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars())


class ApprovalQuerySet:
    async def add(self, session: AsyncSession, row: Approval) -> Approval:
        session.add(row)
        await session.flush()
        return row

    async def get(self, session: AsyncSession, *, graph_id: str, approval_id: str) -> Approval | None:
        row = await session.get(Approval, approval_id)
        return row if row is not None and row.graph_id == graph_id else None

    async def locked(self, session: AsyncSession, *, approval_id: str) -> Approval | None:
        stmt = select(Approval).where(Approval.id == approval_id).with_for_update()
        return (await session.execute(stmt)).scalars().first()

    async def list_for_graph(
        self, session: AsyncSession, *, graph_id: str, status: str | None, limit: int
    ) -> list[Approval]:
        stmt = select(Approval).where(Approval.graph_id == graph_id)
        if status:
            stmt = stmt.where(Approval.status == status)
        return list((await session.execute(stmt.order_by(Approval.deadline_at).limit(limit))).scalars())

    async def page_for_graph(
        self, session: AsyncSession, *, graph_id: str, params: ListParams, approver_id: str | None = None
    ) -> tuple[Sequence[Approval], PageInfo]:
        """One page of the Graph's approvals; with ``approver_id``, only those that name that member.

        ``approver_id`` is the ``mine`` filter resolved to the reader, so the
        unfiltered count leaves it out. ``approver_ids`` is a JSON list, matched
        as text on the quoted id so the one statement reads the same on SQLite
        and Postgres.
        """
        unfiltered = select(Approval).where(Approval.graph_id == graph_id)
        stmt = unfiltered
        if approver_id is not None:
            stmt = stmt.where(cast(Approval.approver_ids, Text).like(f'%"{approver_id}"%'))
        if statuses := params.values("status"):
            stmt = stmt.where(Approval.status.in_(statuses))
        if kinds := params.values("kind"):
            stmt = stmt.where(Approval.subject_kind.in_(kinds))
        if params.q:
            stmt = stmt.where(contains(params.q, Approval.title))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"created_at": Approval.created_at},
            id_column=Approval.id,
        )

    async def to_remind(self, session: AsyncSession, *, now: datetime) -> list[Approval]:
        halfway = Approval.created_at + (Approval.deadline_at - Approval.created_at) / 2
        stmt = (
            select(Approval)
            .where(
                Approval.status == ApprovalStatus.pending.value,
                Approval.reminded_at.is_(None),
                Approval.deadline_at > now,
                halfway <= now,
            )
            .with_for_update(skip_locked=True)
        )
        return list((await session.execute(stmt)).scalars())

    async def overdue(self, session: AsyncSession, *, now: datetime) -> list[Approval]:
        stmt = (
            select(Approval)
            .where(Approval.status == ApprovalStatus.pending.value, Approval.deadline_at <= now)
            .with_for_update(skip_locked=True)
        )
        return list((await session.execute(stmt)).scalars())


class RunOutputQuerySet:
    async def emissions(self, session: AsyncSession, *, run_id: str) -> list[Emission]:
        stmt = select(Emission).where(Emission.run_id == run_id).order_by(Emission.seq)
        return list((await session.execute(stmt)).scalars())
