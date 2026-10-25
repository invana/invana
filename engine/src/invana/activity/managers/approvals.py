"""Approvals — nothing leaves Invana without a named person, and none is ever auto-decided.

docs/for-developers/modules/operate/features/approvals.md. An approval holds the
deliveries a scheduled run is about to send to channels, frozen as they will be
sent. Only a named approver decides; a reminder goes once at half-time; at
the deadline it is ``expired`` and what it held is *expired, not sent*::

    approvals = ApprovalManager()
    row = await approvals.decide(session, graph=graph, approval_id=a.id, user=user, approve=True, note="")
    # its held deliveries are pending; the clock sends them on its next tick

The clock calls ``remind_due`` and ``expire_due`` each tick; both lock what they
touch, so two engine processes never remind or expire one approval twice.

**Approvals is the one queue.** Every ask an agent or a run makes of a person —
access, budget, delegation, send, question, publish — is a row with a ``kind``.
:meth:`ApprovalManager.page` cuts it into the Waiting tabs (*For you* · *All* ·
*Answered*) with the engine's counts, and :meth:`ApprovalManager.reads` fills
each row with the names a person reads. Approving a ``delegation`` with
``scope="always"`` also writes ``always`` for the target agent into the asking
agent's ``policy.may_delegate``; every other kind refuses that scope.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.notifications import InboxManager, Members
from invana.activity.models import Approval, ApprovalStatus, DeliveryStatus, NotificationKind
from invana.activity.querysets import ApprovalQuerySet, DeliveryQuerySet, WaitingQuerySet
from invana.activity.schemas import ApprovalPage, ApprovalRead
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.graphs.models import Graph
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.core.lists import AppliedFilter, ListParams


class ApprovalManager:
    """Stateless. The session is the first argument of every method."""

    approvals_qs = ApprovalQuerySet()
    deliveries_qs = DeliveryQuerySet()
    waiting_qs = WaitingQuerySet()
    agents_qs = AgentQuerySet()
    inbox = InboxManager()

    async def request(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        subject_kind: str,
        subject_id: str,
        title: str,
        payload: dict,
        approver_ids: list[str],
        deadline_s: int,
        requested_by_id: str | None,
        run_id: str | None = None,
        schedule_id: str | None = None,
        now: datetime | None = None,
        kind: str | None = None,
        asked_by: list[dict] | None = None,
        wants: str = "",
        routed_reason: str = "",
        step_run_id: str | None = None,
    ) -> Approval:
        """Hold ``payload`` until one of ``approver_ids`` decides, or ``deadline_s`` passes.

        ``kind`` is the reader's word for the ask; left out, a model publish is
        ``publish`` and anything else a ``send``. ``asked_by`` is the actor chain,
        ``wants`` one line of what is asked, ``routed_reason`` why it went to
        these approvers.
        """
        if not approver_ids:
            raise ValidationError("An approval needs at least one approver.")
        now = now or datetime.now(UTC)
        row = await self.approvals_qs.add(
            session,
            Approval(
                graph_id=graph_id,
                subject_kind=subject_kind,
                subject_id=subject_id,
                run_id=run_id,
                schedule_id=schedule_id,
                title=title[:255],
                payload=payload,
                approver_ids=list(dict.fromkeys(approver_ids)),
                requested_by_id=requested_by_id,
                deadline_at=now + timedelta(seconds=deadline_s),
                created_at=now,
                kind=kind or ("publish" if subject_kind == "model_publish" else "send"),
                asked_by=list(asked_by or []),
                wants=wants[:512],
                routed_reason=routed_reason[:64],
                step_run_id=step_run_id,
            ),
        )
        await self.inbox.tell(
            session,
            user_ids=row.approver_ids,
            graph_id=graph_id,
            kind=NotificationKind.approval.value,
            title=f"Approve: {row.title}"[:255],
            body=f"Decide by {row.deadline_at:%Y-%m-%d %H:%M} UTC, or it expires, not sent.",
            approval_id=row.id,
            schedule_id=schedule_id,
            run_id=run_id,
            target_kind=actions.TARGET_APPROVAL,
            target_id=row.id,
        )
        await self._emit(session, row, actions.APPROVAL_REQUEST, deadline_at=row.deadline_at.isoformat())
        return row

    async def list(
        self, session: AsyncSession, *, graph: Graph, status: str | None = None, mine: User | None = None
    ) -> list[Approval]:
        rows = await self.approvals_qs.list_for_graph(session, graph_id=graph.id, status=status, limit=500)
        if mine is not None:
            rows = [r for r in rows if mine.id in r.approver_ids]
        # Waiting first, nearest deadline first.
        return sorted(rows, key=lambda r: (r.status != ApprovalStatus.pending.value, r.deadline_at))

    async def page(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        params: ListParams,
        reader: User,
        applied: list[AppliedFilter],
    ) -> ApprovalPage:
        """One page of the Approvals list for ``reader``, with the Waiting tabs' counts.

        ``view=for_you`` is what the reader may decide, ``all`` every pending ask
        in the Graph, ``answered`` the decided and expired ones, newest decided
        first. ``mine=true`` keeps the bell tray's reading.
        """
        rows, info = await self.waiting_qs.page(session, graph_id=graph.id, params=params, reader_id=reader.id)
        for_you, pending = await self.waiting_qs.counts(session, graph_id=graph.id, reader_id=reader.id)
        return ApprovalPage(
            items=await self.reads(session, list(rows), reader=reader),
            total=info.total,
            unfiltered_total=info.unfiltered_total,
            next_cursor=info.next_cursor,
            applied=applied,
            for_you=for_you,
            pending=pending,
        )

    async def reads(self, session: AsyncSession, rows: list[Approval], *, reader: User | None) -> list[ApprovalRead]:
        """Each approval as the reader reads it: names, the run's number, whether they may decide."""
        user_ids = {uid for r in rows for uid in r.approver_ids} | {r.decided_by_id for r in rows if r.decided_by_id}
        names = await self.waiting_qs.usernames(session, sorted(user_ids))
        numbers = await self.waiting_qs.run_numbers(session, sorted({r.run_id for r in rows if r.run_id}))
        out = []
        for row in rows:
            read = ApprovalRead.model_validate(row)
            read.approver_names = [names[i] for i in row.approver_ids if i in names]
            read.run_number = numbers.get(row.run_id) if row.run_id else None
            read.can_decide = (
                reader is not None and row.status == ApprovalStatus.pending.value and reader.id in row.approver_ids
            )
            read.decided_by_name = names.get(row.decided_by_id) if row.decided_by_id else None
            out.append(read)
        return out

    async def read(self, session: AsyncSession, row: Approval, *, reader: User | None) -> ApprovalRead:
        return (await self.reads(session, [row], reader=reader))[0]

    async def get(self, session: AsyncSession, *, graph: Graph, approval_id: str) -> Approval:
        row = await self.approvals_qs.get(session, graph_id=graph.id, approval_id=approval_id)
        if row is None:
            raise NotFoundError("Approval not found.")
        return row

    async def decide(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        approval_id: str,
        user: User,
        approve: bool,
        note: str = "",
        scope: str = "run",
        now: datetime | None = None,
    ) -> Approval:
        """Approve or decline. 403 for anyone not named; 409 once decided or past the deadline.

        ``scope="always"`` is for a ``delegation`` only (422 otherwise): approving
        writes ``always`` for the target agent into the asking agent's *May
        delegate to*. Any other ask's decision is recorded and read back by
        whatever waits on it.
        """
        now = now or datetime.now(UTC)
        await self.get(session, graph=graph, approval_id=approval_id)
        row = await self.approvals_qs.locked(session, approval_id=approval_id)
        if scope == "always" and row.kind != "delegation":
            raise ValidationError("Allow always is for a delegation only; this ask is for this run.")
        if user.id not in row.approver_ids:
            names = (await Members.of(session, graph_id=graph.id)).usernames(row.approver_ids)
            raise PermissionDeniedError(f"Only its approvers may decide: {', '.join(names) or 'none left'}.")
        if row.status != ApprovalStatus.pending.value:
            raise ConflictError(f"Already {row.status}.")
        if now >= row.deadline_at:
            raise ConflictError("The deadline has passed; it expires, not sent.")
        row.status = (ApprovalStatus.approved if approve else ApprovalStatus.declined).value
        row.decided_by_id, row.decided_at, row.note = user.id, now, note
        if approve and row.kind == "delegation":
            row.scope = scope
            if scope == "always":
                await self._allow_always(session, graph=graph, row=row)
        released = DeliveryStatus.pending if approve else DeliveryStatus.declined
        for delivery in await self.deliveries_qs.for_approval(session, approval_id=row.id):
            if delivery.status == DeliveryStatus.held.value:
                delivery.status = released.value
        await session.flush()
        await self._emit(
            session,
            row,
            actions.APPROVAL_APPROVE if approve else actions.APPROVAL_DECLINE,
            actor=user.id,
            note=note,
            scope=row.scope,
        )
        return row

    async def _allow_always(self, session: AsyncSession, *, graph: Graph, row: Approval) -> None:
        """Write ``always`` for the target into the asking agent's ``policy.may_delegate``."""
        from_id = (row.payload or {}).get("from_agent_id")
        to_id = (row.payload or {}).get("to_agent_id")
        if not from_id or not to_id:
            raise ValidationError("This delegation names no agents, so it cannot be allowed always.")
        caller = await self.agents_qs.get(session, from_id)
        if caller is None or caller.graph_id != graph.id:
            raise NotFoundError("The agent that asked is gone.")
        policy = dict(caller.policy or {})
        policy["may_delegate"] = {**dict(policy.get("may_delegate") or {}), to_id: "always"}
        caller.policy = policy
        await session.flush()

    async def remind_due(self, session: AsyncSession, *, now: datetime) -> int:
        """Remind the approvers of every approval past half-time, once."""
        rows = await self.approvals_qs.to_remind(session, now=now)
        for row in rows:
            row.reminded_at = now
            await self.inbox.tell(
                session,
                user_ids=row.approver_ids,
                graph_id=row.graph_id,
                kind=NotificationKind.reminder.value,
                title=f"Still waiting on you: {row.title}"[:255],
                body=f"Half the time is gone. Decide by {row.deadline_at:%Y-%m-%d %H:%M} UTC.",
                approval_id=row.id,
                schedule_id=row.schedule_id,
                run_id=row.run_id,
                target_kind=actions.TARGET_APPROVAL,
                target_id=row.id,
            )
            await self._emit(session, row, actions.APPROVAL_REMIND)
        return len(rows)

    async def expire_due(self, session: AsyncSession, *, now: datetime) -> int:
        """End every approval past its deadline as ``expired``; what it held is not sent."""
        rows = await self.approvals_qs.overdue(session, now=now)
        for row in rows:
            row.status = ApprovalStatus.expired.value
            row.decided_at = row.deadline_at
            for delivery in await self.deliveries_qs.for_approval(session, approval_id=row.id):
                if delivery.status == DeliveryStatus.held.value:
                    delivery.status = DeliveryStatus.expired.value
            told = [*row.approver_ids, *([row.requested_by_id] if row.requested_by_id else [])]
            await self.inbox.tell(
                session,
                user_ids=told,
                graph_id=row.graph_id,
                kind=NotificationKind.expired.value,
                title=f"Expired, not sent: {row.title}"[:255],
                body="Nobody decided before the deadline, so nothing was sent.",
                approval_id=row.id,
                schedule_id=row.schedule_id,
                run_id=row.run_id,
                target_kind=actions.TARGET_APPROVAL,
                target_id=row.id,
            )
            await self._emit(session, row, actions.APPROVAL_EXPIRE)
        await session.flush()
        return len(rows)

    async def _emit(self, session: AsyncSession, row: Approval, action: str, actor: str | None = None, **extra) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_APPROVAL,
            target_id=row.id,
            graph_id=row.graph_id,
            run_id=row.run_id,
            actor_kind=ActorKind.user if actor else ActorKind.system,
            actor_id=actor,
            details={"title": row.title, "status": row.status, "subject_kind": row.subject_kind, **extra},
        )


class ApprovalSendGate:
    """The runtime's send gate over the approvals inbox: one approval per held ``send`` step.

    The runtime sits below the inbox, so it names only the gate's shape; each
    front-end installs this one on ``TaskRuntime.send_gate`` when it builds a
    runtime (the API at start-up, the CLI in ``with_runtime``). ``request``
    asks the one approver the runtime names, with the step's frozen args as the
    payload; ``decision`` reads the approval back fresh — the run's session may
    have seen it before the decision — with the decider's username for the
    *declined by* sentence.
    """

    approvals = ApprovalManager()

    async def request(
        self,
        db: AsyncSession,
        *,
        graph_id: str,
        run_id: str,
        step_id: str,
        title: str,
        payload: dict,
        approver_id: str,
        deadline_s: int,
    ) -> str:
        row = await self.approvals.request(
            db,
            graph_id=graph_id,
            subject_kind="step",
            subject_id=step_id,
            title=title,
            payload=payload,
            approver_ids=[approver_id] if approver_id else [],
            deadline_s=deadline_s,
            requested_by_id=None,
            run_id=run_id,
        )
        return row.id

    async def decision(self, db: AsyncSession, *, approval_id: str) -> tuple[str, str]:
        row = await db.get(Approval, approval_id, populate_existing=True)
        if row is None:
            return "expired", ""
        who = await db.get(User, row.decided_by_id) if row.decided_by_id else None
        return row.status, who.username if who else ""
