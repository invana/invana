"""Schedules — routine work that runs itself and lands where people read.

docs/for-developers/modules/operate/features/schedules.md. A schedule names an
agent, the instructions it carries out, a cron read in a time zone, and where
the result is delivered. Each occurrence is a **firing**, recorded whether it
ran or not::

    schedules = ScheduleManager()
    row = await schedules.create(session, graph=graph, actor_id=user.id, payload=ScheduleCreate(
        name="morning digest", agent="explorer", instructions="What changed overnight?",
        cron="0 8 * * 1-5", timezone="Europe/Berlin", channels=["ops"]))
    await schedules.run_now(session, graph=graph, ref=row.id, actor_id=user.id)  # a queued firing

The clock does the rest each tick: ``fire_due`` opens the runs of due and
queued firings — applying the missed-firing policy and the overlap policy — and
returns their ids to submit once committed; ``deliver_settled``
hands each settled run to the inbox and the channels, holding outward sends
for an approval unless the schedule switched that off.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.approvals import ApprovalManager
from invana.activity.managers.channels import ChannelManager, render
from invana.activity.managers.notifications import InboxManager, Members, graph_link
from invana.activity.models import (
    DeliveryStatus,
    FiringOutcome,
    MissedPolicy,
    NotificationDelivery,
    NotificationKind,
    OverlapPolicy,
    Schedule,
    ScheduleFiring,
    ScheduleStatus,
)
from invana.activity.querysets import (
    DeliveryQuerySet,
    FiringQuerySet,
    RunOutputQuerySet,
    ScheduleQuerySet,
)
from invana.activity.schemas import ScheduleCreate, ScheduleRead, ScheduleUpdate
from invana.apps.agents.models import Agent
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.graphs.models import Graph
from invana.core import cron
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.core.lists import ListParams, PageInfo
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.services import open_schedule_run

#: How late the clock may reach a firing before it counts as missed.
GRACE = timedelta(minutes=5)
#: The most missed firings ``run_all`` replays.
RUN_ALL_CAP = 24
#: A run in one of these has settled and can be delivered.
SETTLED = frozenset(
    {RunStatus.succeeded.value, RunStatus.failed.value, RunStatus.cancelled.value, RunStatus.stopped.value}
)
_WORD = {"succeeded": "ready", "failed": "failed", "cancelled": "cancelled", "stopped": "stopped"}


class ScheduleManager:
    """Stateless. Writing a schedule is the ``work`` area; the guard enforces it."""

    schedules_qs = ScheduleQuerySet()
    firings_qs = FiringQuerySet()
    deliveries_qs = DeliveryQuerySet()
    outputs_qs = RunOutputQuerySet()
    agents_qs = AgentQuerySet()
    channels = ChannelManager()
    approvals = ApprovalManager()
    inbox = InboxManager()

    def read(self, row: Schedule) -> ScheduleRead:
        return ScheduleRead.model_validate(row)

    # ── reading ──────────────────────────────────────────────────────────────

    async def list(self, session: AsyncSession, *, graph: Graph) -> list[Schedule]:
        return await self.schedules_qs.list_for_graph(session, graph_id=graph.id)

    async def page(
        self, session: AsyncSession, *, graph: Graph, params: ListParams
    ) -> tuple[Sequence[Schedule], PageInfo]:
        """One page of the Schedules list, searched, filtered and sorted by ``params``."""
        return await self.schedules_qs.page_for_graph(session, graph_id=graph.id, params=params)

    async def paused_count(self, session: AsyncSession, *, graph: Graph) -> int:
        """The Graph's paused schedules, whatever the list is filtered by."""
        return await self.schedules_qs.paused_count(session, graph_id=graph.id)

    async def get(self, session: AsyncSession, *, graph: Graph, ref: str) -> Schedule:
        row = await self.schedules_qs.by_ref(session, graph_id=graph.id, ref=ref)
        if row is None:
            raise NotFoundError("Schedule not found.")
        return row

    async def firings(self, session: AsyncSession, *, graph: Graph, ref: str, limit: int = 50) -> list[ScheduleFiring]:
        row = await self.get(session, graph=graph, ref=ref)
        return await self.firings_qs.for_schedule(session, schedule_id=row.id, limit=max(1, min(limit, 200)))

    # ── writing ──────────────────────────────────────────────────────────────

    async def _agent(self, session: AsyncSession, *, graph_id: str, ref: str) -> Agent:
        agent = await self.agents_qs.get_by_key(session, graph_id=graph_id, key=ref)
        if agent is None:
            found = await self.agents_qs.get(session, ref)
            agent = found if found is not None and found.graph_id == graph_id else None
        if agent is None:
            raise ValidationError(f"No agent {ref!r} on this Graph.")
        return agent

    async def _fill(self, session: AsyncSession, row: Schedule, fields: dict, graph: Graph, now: datetime) -> None:
        if "agent" in fields:
            row.agent_id = (await self._agent(session, graph_id=graph.id, ref=fields["agent"])).id
        members = None
        for key, column in (("recipients", "recipient_ids"), ("approvers", "approver_ids")):
            if key in fields:
                members = members or await Members.of(session, graph_id=graph.id)
                setattr(row, column, members.ids(fields[key] or []))
        if "channels" in fields:
            row.channel_ids = await self.channels.resolve(session, graph_id=graph.id, refs=fields["channels"] or [])
        for key in (
            "name",
            "instructions",
            "cron",
            "timezone",
            "missed",
            "overlap",
            "deliver_in_app",
            "approve_outward",
            "approval_deadline_s",
        ):
            if key in fields and fields[key] is not None:
                setattr(row, key, fields[key])
        if not (row.deliver_in_app or row.channel_ids):
            raise ValidationError("A schedule needs somewhere to deliver: the inbox or a channel.")
        try:
            following = cron.next_fire(row.cron, row.timezone, after=now)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        if row.status == ScheduleStatus.active.value and ({"cron", "timezone"} & fields.keys() or not row.next_fire_at):
            row.next_fire_at = following

    async def create(self, session: AsyncSession, *, graph: Graph, payload: ScheduleCreate, actor_id: str) -> Schedule:
        if await self.schedules_qs.by_ref(session, graph_id=graph.id, ref=payload.name):
            raise ConflictError(f"A schedule named {payload.name!r} already exists.")
        row = Schedule(graph_id=graph.id, owner_id=actor_id, status=ScheduleStatus.active.value)
        await self._fill(session, row, payload.model_dump(), graph, datetime.now(UTC))
        session.add(row)
        await session.flush()
        await self._emit(session, row, actions.SCHEDULE_CREATE, actor_id, cron=row.cron, timezone=row.timezone)
        return row

    async def update(
        self, session: AsyncSession, *, graph: Graph, ref: str, payload: ScheduleUpdate, actor_id: str
    ) -> Schedule:
        row = await self.get(session, graph=graph, ref=ref)
        fields = payload.model_dump(exclude_unset=True)
        if (
            fields.get("name")
            and fields["name"] != row.name
            and await self.schedules_qs.by_ref(session, graph_id=graph.id, ref=fields["name"])
        ):
            raise ConflictError(f"A schedule named {fields['name']!r} already exists.")
        await self._fill(session, row, fields, graph, datetime.now(UTC))
        await session.flush()
        await self._emit(session, row, actions.SCHEDULE_UPDATE, actor_id, changed=sorted(fields))
        return row

    async def apply(self, session: AsyncSession, *, graph: Graph, payload: ScheduleCreate, actor_id: str) -> Schedule:
        """Create the schedule named in ``payload``, or update the one that has its name."""
        row = await self.schedules_qs.by_ref(session, graph_id=graph.id, ref=payload.name)
        if row is None:
            return await self.create(session, graph=graph, payload=payload, actor_id=actor_id)
        update = ScheduleUpdate(**payload.model_dump())
        return await self.update(session, graph=graph, ref=row.id, payload=update, actor_id=actor_id)

    async def pause(self, session: AsyncSession, *, graph: Graph, ref: str, actor_id: str) -> Schedule:
        row = await self.get(session, graph=graph, ref=ref)
        if row.status != ScheduleStatus.paused.value:
            row.status, row.next_fire_at = ScheduleStatus.paused.value, None
            await session.flush()
            await self._emit(session, row, actions.SCHEDULE_PAUSE, actor_id)
        return row

    async def resume(self, session: AsyncSession, *, graph: Graph, ref: str, actor_id: str) -> Schedule:
        """Fire from now: what came due while paused is not missed."""
        row = await self.get(session, graph=graph, ref=ref)
        if row.status != ScheduleStatus.active.value:
            row.status = ScheduleStatus.active.value
            row.next_fire_at = cron.next_fire(row.cron, row.timezone, after=datetime.now(UTC))
            await session.flush()
            await self._emit(session, row, actions.SCHEDULE_RESUME, actor_id)
        return row

    async def delete(self, session: AsyncSession, *, graph: Graph, ref: str, actor_id: str) -> None:
        row = await self.get(session, graph=graph, ref=ref)
        await self._emit(session, row, actions.SCHEDULE_DELETE, actor_id)
        await session.delete(row)
        await session.flush()

    async def run_now(self, session: AsyncSession, *, graph: Graph, ref: str, actor_id: str) -> ScheduleFiring:
        """A firing now, outside the cron. The clock opens its run once this commits."""
        row = await self.get(session, graph=graph, ref=ref)
        now = datetime.now(UTC)
        return await self.firings_qs.add(
            session,
            ScheduleFiring(
                schedule_id=row.id,
                graph_id=row.graph_id,
                due_at=now,
                outcome=FiringOutcome.queued.value,
                manual=True,
                actor_id=actor_id,
            ),
        )

    # ── the clock's steps ────────────────────────────────────────────────────

    async def fire_due(self, session: AsyncSession, *, now: datetime) -> list[str]:
        """Record every firing that has come due and open its run; the run ids to submit."""
        opened: list[str] = []
        for schedule in await self.schedules_qs.due(session, now=now):
            due: list[datetime] = []
            at = schedule.next_fire_at
            while at <= now and len(due) < 10_000:
                due.append(at)
                at = cron.next_fire(schedule.cron, schedule.timezone, after=at)
            schedule.next_fire_at = at
            late = [d for d in due if now - d > GRACE]
            on_time = [d for d in due if now - d <= GRACE]
            run, skip = list(on_time), []
            if late:
                policy = schedule.missed
                if policy == MissedPolicy.catch_up.value and not on_time:
                    run.insert(0, late[-1])
                    skip = late[:-1]
                elif policy == MissedPolicy.run_all.value:
                    run = late[-RUN_ALL_CAP:] + run
                    skip = late[:-RUN_ALL_CAP]
                else:
                    skip = late
            for when in skip:
                reason = (
                    f"missed; more than {RUN_ALL_CAP} came due"
                    if schedule.missed == MissedPolicy.run_all.value
                    else "missed while the engine was not running"
                )
                await self._skip(session, schedule, ScheduleFiring(due_at=when), now, reason)
            for when in run:
                firing = ScheduleFiring(due_at=when, catch_up=when in late, manual=False)
                run_id = await self._open(session, schedule, firing, now)
                opened += [run_id] if run_id else []
        for firing in await self.firings_qs.queued(session):
            schedule = await session.get(Schedule, firing.schedule_id)
            run_id = await self._open(session, schedule, firing, now)
            opened += [run_id] if run_id else []
        return opened

    async def _skip(
        self, session: AsyncSession, schedule: Schedule, firing: ScheduleFiring, now: datetime, reason: str
    ) -> None:
        firing.schedule_id, firing.graph_id = schedule.id, schedule.graph_id
        firing.outcome, firing.fired_at, firing.reason = FiringOutcome.skipped.value, now, reason
        if firing not in session:
            await self.firings_qs.add(session, firing)
        await self._emit(
            session, schedule, actions.SCHEDULE_SKIP, None, due_at=firing.due_at.isoformat(), reason=reason
        )

    async def _open(
        self, session: AsyncSession, schedule: Schedule, firing: ScheduleFiring, now: datetime
    ) -> str | None:
        firing.schedule_id, firing.graph_id = schedule.id, schedule.graph_id
        if schedule.overlap == OverlapPolicy.skip.value:
            last = await self.firings_qs.last_opened(session, schedule_id=schedule.id)
            previous = await self.firings_qs.run(session, run_id=last.run_id) if last and last.run_id else None
            if previous is not None and previous.status not in SETTLED:
                await self._skip(session, schedule, firing, now, "the previous run is still going")
                return None
        agent = await session.get(Agent, schedule.agent_id) if schedule.agent_id else None
        failure = (
            "the schedule's agent was deleted"
            if agent is None
            else f"'{agent.name}' is {agent.status}"
            if not agent.is_available
            else "the schedule has no owner"
            if schedule.owner_id is None
            else ""
        )
        firing.fired_at = now
        if failure:
            firing.outcome, firing.reason = FiringOutcome.failed.value, failure
        else:
            run = await open_schedule_run(
                session,
                graph=await session.get(Graph, schedule.graph_id),
                schedule_id=schedule.id,
                schedule_name=schedule.name,
                instructions=schedule.instructions,
                agent=agent,
                on_behalf_of_user_id=schedule.owner_id,
            )
            firing.outcome, firing.run_id = FiringOutcome.opened.value, run.id
            firing.reason = "catch-up" if firing.catch_up else ("run now" if firing.manual else "")
        if firing not in session:
            await self.firings_qs.add(session, firing)
        await session.flush()
        await self._emit(
            session,
            schedule,
            actions.SCHEDULE_FIRE,
            firing.actor_id,
            run_id=firing.run_id,
            outcome=firing.outcome,
            reason=firing.reason,
            catch_up=firing.catch_up,
            manual=firing.manual,
        )
        return firing.run_id

    async def deliver_settled(self, session: AsyncSession, *, now: datetime) -> int:
        """Hand every settled scheduled run to the inbox and the channels, once."""
        delivered = 0
        for firing, run in await self.firings_qs.settled_undelivered(session, terminal=SETTLED):
            firing.delivered_at = now
            schedule = await session.get(Schedule, firing.schedule_id)
            if schedule is None:
                continue
            message = await self._message(session, schedule, run)
            if schedule.deliver_in_app:
                await self.inbox.tell(
                    session,
                    user_ids=[i for i in (schedule.owner_id, *schedule.recipient_ids) if i],
                    graph_id=schedule.graph_id,
                    kind=NotificationKind.delivery.value,
                    title=message["title"][:255],
                    body=message["body"],
                    schedule_id=schedule.id,
                    run_id=run.id,
                    target_kind=actions.TARGET_THINKING,
                    target_id=run.id,
                )
            await self._to_channels(session, schedule, firing, run, message)
            delivered += 1
        await session.flush()
        return delivered

    async def _to_channels(
        self, session: AsyncSession, schedule: Schedule, firing: ScheduleFiring, run: TaskRun, message: dict
    ) -> None:
        held = schedule.approve_outward
        rows, frozen = [], []
        for channel_id in schedule.channel_ids:
            channel = await self.deliveries_qs.channel(session, channel_id=channel_id)
            if channel is None:
                continue
            payload = render(channel.kind, message)
            rows.append(
                await self.deliveries_qs.add(
                    session,
                    NotificationDelivery(
                        graph_id=schedule.graph_id,
                        channel_id=channel.id,
                        firing_id=firing.id,
                        status=(DeliveryStatus.held if held else DeliveryStatus.pending).value,
                        payload=payload,
                    ),
                )
            )
            frozen.append({"channel": channel.name, "kind": channel.kind, "target": channel.target, "payload": payload})
        if not (held and rows):
            return
        approval = await self.approvals.request(
            session,
            graph_id=schedule.graph_id,
            subject_kind="delivery",
            subject_id=firing.id,
            title=f"{message['title']} → {', '.join(f['channel'] for f in frozen)}",
            payload={"channels": frozen},
            approver_ids=schedule.approver_ids or [schedule.owner_id],
            deadline_s=schedule.approval_deadline_s,
            requested_by_id=schedule.owner_id,
            run_id=run.id,
            schedule_id=schedule.id,
        )
        for row in rows:
            row.approval_id = approval.id

    async def _message(self, session: AsyncSession, schedule: Schedule, run: TaskRun) -> dict:
        """The settled run as people read it: what it answered, or why it did not."""
        parts = []
        for emission in await self.outputs_qs.emissions(session, run_id=run.id):
            payload = emission.payload or {}
            if emission.kind == "prose" and payload.get("text"):
                parts.append(str(payload["text"]))
            elif emission.kind == "table":
                parts.append(f"A table of {len(payload.get('rows') or [])} rows.")
            elif emission.kind == "metric" and "value" in payload:
                parts.append(f"{payload.get('label', 'Value')}: {payload['value']}")
        if not parts:
            error = (run.error or {}).get("message") if isinstance(run.error, dict) else None
            parts.append(error or run.detail or "The run produced nothing to read.")
        return {
            "title": f"{schedule.name} · {_WORD.get(run.status, run.status)}",
            "body": "\n\n".join(parts),
            "link": await graph_link(session, graph_id=schedule.graph_id, run_id=run.id),
            "schedule": schedule.name,
            "run_id": run.id,
            "status": run.status,
        }

    async def _emit(self, session: AsyncSession, row: Schedule, action: str, actor_id: str | None, **extra) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_SCHEDULE,
            target_id=row.id,
            graph_id=row.graph_id,
            run_id=extra.get("run_id"),
            actor_kind=ActorKind.user if actor_id else ActorKind.system,
            actor_id=actor_id,
            details={"name": row.name, **extra},
        )
