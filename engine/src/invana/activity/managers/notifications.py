"""Notification rules, the inbox, and matching the event record against the rules.

docs/for-developers/modules/operate/features/notifications.md. A rule names
event actions (``run.finish``, ``approval.*``), an optional equality ``match``
on the event's details, its people — named members, holders of Graph roles,
the requester — and where it goes: the inbox and any channels::

    rules = NotificationRuleManager()
    await rules.create(session, graph=graph, actor_id=user.id, payload=NotificationRuleWrite(
        name="failed runs", events=["run.finish"], match={"status": "failed"},
        requester=True, roles=["owner"], channels=["ops"]))

    inbox = InboxManager()
    page = await inbox.inbox(session, graph=graph, user=user, unread=True)
    await inbox.mark_read(session, graph=graph, user=user, ids=None)

Rules read the record after commit, through a persisted cursor: the clock
calls ``EventMatcher.match_new``; a write is never slowed by a rule. Recipients
resolve when the event is matched — someone who left the Graph is skipped,
and an event on a private project reaches only the people staffed on it.
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.channels import ChannelManager, render
from invana.activity.models import (
    ApprovalStatus,
    DeliveryStatus,
    Notification,
    NotificationKind,
    NotificationRule,
)
from invana.activity.querysets import ApprovalQuerySet, CursorQuerySet, DeliveryQuerySet, InboxQuerySet, RuleQuerySet
from invana.activity.schemas import (
    InboxResponse,
    NotificationRead,
    NotificationRuleRead,
    NotificationRuleUpdate,
    NotificationRuleWrite,
)
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.querysets import GraphMemberQuerySet
from invana.apps.graphs.roles import GraphRole
from invana.apps.work.managers import ProjectManager
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.models import ActorKind, Event
from invana.core.events.services import emit_event
from invana.core.settings import settings

_PATTERN = re.compile(r"^(\*|[a-z_]+(\.[a-z_]+|\.\*)?)$")
_CURSOR = "rules"
_BATCH = 500


def unmatched(action: str) -> bool:
    """Actions no rule may match — what a rule sends must never wake a rule."""
    return action in actions.UNMATCHED_ACTIONS or action.startswith(actions.UNMATCHED_PREFIXES)


def rule_matches(rule: NotificationRule, event: Event) -> bool:
    if unmatched(event.action):
        return False
    hit = any(p in ("*", event.action) or (p.endswith(".*") and event.action.startswith(p[:-1])) for p in rule.events)
    details = event.details or {}
    return hit and all(details.get(k) == v for k, v in (rule.match or {}).items())


class Members:
    """A Graph's members, read once, resolvable by id, username or email."""

    def __init__(self, rows: list[GraphMember]) -> None:
        self.rows = {row.user.id: row for row in rows}
        self._refs = {}
        for row in rows:
            for key in (row.user.id, row.user.username, row.user.email):
                if key:
                    self._refs[key] = row.user.id

    @classmethod
    async def of(cls, session: AsyncSession, *, graph_id: str) -> Members:
        return cls(await GraphMemberQuerySet().list_for_graph(session, graph_id=graph_id))

    def ids(self, refs: list[str]) -> list[str]:
        """Member ids for ``refs``; 422 naming anyone who is not a member."""
        unknown = [r for r in refs if r not in self._refs]
        if unknown:
            raise ValidationError(f"Not a member of this Graph: {', '.join(unknown)}.")
        return list(dict.fromkeys(self._refs[r] for r in refs))

    def usernames(self, ids: list[str]) -> list[str]:
        return [self.rows[i].user.username for i in ids if i in self.rows]

    def holding(self, role: str) -> set[str]:
        return {uid for uid, row in self.rows.items() if row.holds(role)}


def _roles(roles: list[str]) -> list[str]:
    known = {r.value for r in GraphRole}
    bad = [r for r in roles if r not in known]
    if bad:
        raise ValidationError(f"Unknown Graph role: {', '.join(bad)}.")
    return list(dict.fromkeys(roles))


def _events(events: list[str]) -> list[str]:
    for pattern in events:
        if not _PATTERN.match(pattern):
            raise ValidationError(f"{pattern!r} is not an action or an action prefix ending in '.*'.")
        if pattern != "*" and unmatched(pattern.removesuffix("*")):
            raise ValidationError(f"{pattern!r}: a rule never matches deliveries or reminders.")
    return list(dict.fromkeys(events))


async def graph_link(session: AsyncSession, *, graph_id: str, run_id: str | None) -> str:
    """Studio's URL for the run, or for the Graph's Activity when there is none."""
    graph = await session.get(Graph, graph_id)
    owner = await session.get(User, graph.created_by_id) if graph else None
    if graph is None or owner is None:
        return ""
    base = f"{settings.studio_base_url.rstrip('/')}/u/{owner.username}/{graph.slug}/activity"
    return f"{base}/runs/{run_id}" if run_id else f"{base}/inbox"


class NotificationRuleManager:
    """Stateless. Writing a rule is the ``settings`` area; the guard enforces it."""

    rules_qs = RuleQuerySet()
    channels = ChannelManager()

    def read(self, row: NotificationRule) -> NotificationRuleRead:
        return NotificationRuleRead.model_validate(row)

    async def list(self, session: AsyncSession, *, graph: Graph) -> list[NotificationRule]:
        return await self.rules_qs.list_for_graph(session, graph_id=graph.id)

    async def get(self, session: AsyncSession, *, graph: Graph, rule_id: str) -> NotificationRule:
        row = await self.rules_qs.get(session, graph_id=graph.id, rule_id=rule_id)
        if row is None:
            row = await self.rules_qs.by_name(session, graph_id=graph.id, name=rule_id)
        if row is None:
            raise NotFoundError("Rule not found.")
        return row

    async def _fill(self, session: AsyncSession, row: NotificationRule, fields: dict, graph: Graph) -> None:
        if "events" in fields:
            row.events = _events(fields["events"])
        if "match" in fields:
            row.match = dict(fields["match"] or {})
        if "members" in fields:
            row.member_ids = (await Members.of(session, graph_id=graph.id)).ids(fields["members"] or [])
        if "roles" in fields:
            row.roles = _roles(fields["roles"] or [])
        if "channels" in fields:
            row.channel_ids = await self.channels.resolve(session, graph_id=graph.id, refs=fields["channels"] or [])
        for key in ("name", "requester", "in_app", "enabled"):
            if key in fields:
                setattr(row, key, fields[key])
        if not (row.member_ids or row.roles or row.requester):
            raise ValidationError("A rule needs recipients: members, roles or the requester.")
        if not (row.in_app or row.channel_ids):
            raise ValidationError("A rule needs somewhere to go: the inbox or a channel.")

    async def create(
        self, session: AsyncSession, *, graph: Graph, payload: NotificationRuleWrite, actor_id: str
    ) -> NotificationRule:
        if await self.rules_qs.by_name(session, graph_id=graph.id, name=payload.name):
            raise ConflictError(f"A rule named {payload.name!r} already exists.")
        row = NotificationRule(graph_id=graph.id, created_by_id=actor_id)
        await self._fill(session, row, payload.model_dump(), graph)
        await self.rules_qs.add(session, row)
        await self._emit(session, row, actions.NOTIFICATION_RULE_CREATE, actor_id)
        return row

    async def update(
        self, session: AsyncSession, *, graph: Graph, rule_id: str, payload: NotificationRuleUpdate, actor_id: str
    ) -> NotificationRule:
        row = await self.get(session, graph=graph, rule_id=rule_id)
        fields = payload.model_dump(exclude_unset=True)
        if (
            fields.get("name")
            and fields["name"] != row.name
            and await self.rules_qs.by_name(session, graph_id=graph.id, name=fields["name"])
        ):
            raise ConflictError(f"A rule named {fields['name']!r} already exists.")
        await self._fill(session, row, fields, graph)
        await session.flush()
        await self._emit(session, row, actions.NOTIFICATION_RULE_UPDATE, actor_id, changed=sorted(fields))
        return row

    async def apply(
        self, session: AsyncSession, *, graph: Graph, payload: NotificationRuleWrite, actor_id: str
    ) -> NotificationRule:
        """Create the rule named in ``payload``, or replace the one that has its name."""
        row = await self.rules_qs.by_name(session, graph_id=graph.id, name=payload.name)
        if row is None:
            return await self.create(session, graph=graph, payload=payload, actor_id=actor_id)
        return await self.update(
            session,
            graph=graph,
            rule_id=row.id,
            payload=NotificationRuleUpdate(**payload.model_dump()),
            actor_id=actor_id,
        )

    async def delete(self, session: AsyncSession, *, graph: Graph, rule_id: str, actor_id: str) -> None:
        row = await self.get(session, graph=graph, rule_id=rule_id)
        await self._emit(session, row, actions.NOTIFICATION_RULE_DELETE, actor_id)
        await self.rules_qs.delete(session, row)

    async def _emit(self, session: AsyncSession, row: NotificationRule, action: str, actor_id: str, **extra) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_NOTIFICATION_RULE,
            target_id=row.id,
            graph_id=row.graph_id,
            actor_id=actor_id,
            details={"name": row.name, "events": row.events, **extra},
        )


class InboxManager:
    """One person's notifications on one Graph."""

    inbox_qs = InboxQuerySet()
    approvals_qs = ApprovalQuerySet()

    async def inbox(
        self, session: AsyncSession, *, graph: Graph, user: User, unread: bool = False, limit: int = 50
    ) -> InboxResponse:
        rows = await self.inbox_qs.for_user(
            session, graph_id=graph.id, user_id=user.id, unread=unread, limit=max(1, min(limit, 200))
        )
        pending = await self.approvals_qs.list_for_graph(
            session, graph_id=graph.id, status=ApprovalStatus.pending.value, limit=500
        )
        return InboxResponse(
            items=[NotificationRead.model_validate(r) for r in rows],
            unread=await self.inbox_qs.unread_count(session, graph_id=graph.id, user_id=user.id),
            approvals_waiting=sum(1 for a in pending if user.id in a.approver_ids),
        )

    async def mark_read(self, session: AsyncSession, *, graph: Graph, user: User, ids: list[str] | None) -> int:
        return await self.inbox_qs.mark_read(
            session, graph_id=graph.id, user_id=user.id, ids=ids, now=datetime.now(UTC)
        )

    async def tell(self, session: AsyncSession, *, user_ids: list[str] | set[str], **fields) -> None:
        """One inbox row for each of ``user_ids``."""
        for user_id in dict.fromkeys(user_ids):
            await self.inbox_qs.add(session, Notification(user_id=user_id, **fields))


class EventMatcher:
    """The clock's step that turns new events into inbox rows and deliveries."""

    cursor_qs = CursorQuerySet()
    rules_qs = RuleQuerySet()
    inbox_qs = InboxQuerySet()
    deliveries_qs = DeliveryQuerySet()
    projects = ProjectManager()

    async def match_new(self, session: AsyncSession, *, now: datetime) -> int:
        """Match the events written since the cursor; how many were read.

        The first run starts the cursor at ``now`` — rules see what happens after
        they exist, not the Graph's whole history.
        """
        cursor = await self.cursor_qs.take(session, name=_CURSOR)
        if cursor is None:
            await self.cursor_qs.create(session, name=_CURSOR, at=now)
            return 0
        events = await self.cursor_qs.events_after(session, cursor=cursor, limit=_BATCH)
        if not events:
            return 0
        graph_ids = {e.graph_id for e in events if e.graph_id}
        rules: dict[str, list[NotificationRule]] = {}
        for rule in await self.rules_qs.enabled_for(session, graph_ids=graph_ids) if graph_ids else []:
            rules.setdefault(rule.graph_id, []).append(rule)
        members: dict[str, Members] = {}
        for event in events:
            for rule in rules.get(event.graph_id or "", []):
                if rule_matches(rule, event):
                    if event.graph_id not in members:
                        members[event.graph_id] = await Members.of(session, graph_id=event.graph_id)
                    await self._notify(session, rule, event, members[event.graph_id])
        cursor.created_at, cursor.event_id = events[-1].created_at, events[-1].id
        await session.flush()
        return len(events)

    async def _recipients(
        self, session: AsyncSession, rule: NotificationRule, event: Event, members: Members
    ) -> set[str]:
        ids = {i for i in rule.member_ids if i in members.rows}
        for role in rule.roles:
            ids |= members.holding(role)
        if rule.requester:
            who = event.on_behalf_of_user_id or (event.actor_id if event.actor_kind == ActorKind.user else None)
            if who in members.rows:
                ids.add(who)
        if event.project_id:
            ids = {
                uid
                for uid in ids
                if event.project_id
                not in await self.projects.hidden_ids(session, graph_id=rule.graph_id, reader_id=uid)
            }
        return ids

    async def _notify(self, session: AsyncSession, rule: NotificationRule, event: Event, members: Members) -> None:
        details = event.details or {}
        status = details.get("status")
        title = f"{rule.name}: {event.action}" + (f" · {status}" if isinstance(status, str) else "")
        actor = details.get("actor_name") or details.get("name") or ""
        body = " · ".join(str(p) for p in (actor, event.target_kind, details.get("outcome")) if p)
        if rule.in_app:
            for user_id in await self._recipients(session, rule, event, members):
                await self.inbox_qs.add_once(
                    session,
                    {
                        "id": _uuid(),
                        "graph_id": rule.graph_id,
                        "user_id": user_id,
                        "kind": NotificationKind.event.value,
                        "title": title[:255],
                        "body": body,
                        "event_id": event.id,
                        "rule_id": rule.id,
                        "run_id": event.run_id,
                        "target_kind": event.target_kind,
                        "target_id": event.target_id,
                        "created_at": datetime.now(UTC),
                    },
                )
        if not rule.channel_ids:
            return
        message = {
            "title": title,
            "body": body,
            "link": await graph_link(session, graph_id=rule.graph_id, run_id=event.run_id),
            "event": event.action,
            "event_id": event.id,
            "run_id": event.run_id,
        }
        for channel_id in rule.channel_ids:
            channel = await self.deliveries_qs.channel(session, channel_id=channel_id)
            if channel is None:
                continue
            await self.deliveries_qs.add_once(
                session,
                {
                    "id": _uuid(),
                    "graph_id": rule.graph_id,
                    "channel_id": channel_id,
                    "rule_id": rule.id,
                    "event_id": event.id,
                    "status": DeliveryStatus.pending.value,
                    "payload": render(channel.kind, message),
                    "attempts": 0,
                    "error": "",
                    "created_at": datetime.now(UTC),
                },
            )


def _uuid() -> str:
    return str(uuid.uuid4())
