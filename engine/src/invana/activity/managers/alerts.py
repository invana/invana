"""Alert rules — rules over the ledger that tell people in their inbox
(docs/for-developers/modules/operate/features/approvals.md, Alert rules).

A rule names what a ledger row must be to match — an act pattern
(``graph.write.*``), a touched pattern (``graph/Fare``), verdicts and refusal
reasons — and optionally a threshold: ``count`` matches within ``window_s``.
The clock calls :func:`evaluate_alert_rules` every tick; it reads each enabled
rule's Graph's rows after the rule's ``last_seq``, and on a match tells each
named member in the inbox, records ``last_fired_at`` and advances ``last_seq``.
A new rule starts at the Graph's head, so it sees what happens after it exists::

    rules = AlertRuleManager()
    row = await rules.create(session, graph=graph, payload=AlertRuleCreate(...), actor_id=user.id)
    fired = await evaluate_alert_rules(session, now=datetime.now(UTC))

Writing a rule is the Graph's ``settings`` area; each create, update and delete
emits an event.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from fnmatch import fnmatchcase

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.notifications import InboxManager, Members
from invana.activity.models import AlertRule, NotificationKind
from invana.activity.querysets import AlertRuleQuerySet
from invana.activity.schemas import AlertMatch, AlertRuleCreate, AlertRuleRead, AlertRuleUpdate
from invana.apps.graphs.models import Graph
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.core.ledger.models import LedgerRow

ALERT_RULE_CREATE = "alert_rule.create"
ALERT_RULE_UPDATE = "alert_rule.update"
ALERT_RULE_DELETE = "alert_rule.delete"
TARGET_ALERT_RULE = "alert_rule"


def _pattern_matches(pattern: str, value: str) -> bool:
    """``*`` glob over the whole value; a touched pattern also reaches the records under it."""
    if not pattern:
        return True
    return fnmatchcase(value, pattern) or value.startswith((f"{pattern}:", f"{pattern}/"))


def row_matches(match: AlertMatch, row: LedgerRow) -> bool:
    """Whether one ledger row is what ``match`` describes. Empty parts match anything."""
    if match.act and not fnmatchcase(row.act, match.act):
        return False
    if match.touched and not _pattern_matches(match.touched, row.touched or ""):
        return False
    if match.verdict and row.verdict not in match.verdict:
        return False
    return not (match.refused_by and (row.refused_by or "") not in match.refused_by)


def match_line(match: AlertMatch) -> str:
    """The match in one line — ``graph.write.* on Fare · allowed``."""
    head = match.act or "any act"
    if match.touched:
        head += f" on {match.touched.split('/', 1)[-1]}"
    parts = [head]
    if match.verdict:
        parts.append(" · ".join(match.verdict))
    if match.refused_by:
        parts.append("refused by " + " · ".join(match.refused_by))
    if match.threshold:
        minutes = max(match.threshold.window_s // 60, 1)
        parts.append(f"{match.threshold.count}+ in {minutes} min")
    return " · ".join(parts)


class AlertRuleManager:
    """Stateless. The session is the first argument of every method."""

    rules_qs = AlertRuleQuerySet()
    inbox = InboxManager()

    async def list(self, session: AsyncSession, *, graph: Graph) -> list[AlertRuleRead]:
        rows = await self.rules_qs.list_for_graph(session, graph_id=graph.id)
        return await self.reads(session, graph_id=graph.id, rows=rows)

    async def get(self, session: AsyncSession, *, graph: Graph, rule_id: str) -> AlertRule:
        row = await self.rules_qs.get(session, graph_id=graph.id, rule_id=rule_id)
        if row is None:
            raise NotFoundError("Alert rule not found.")
        return row

    async def reads(self, session: AsyncSession, *, graph_id: str, rows: list[AlertRule]) -> list[AlertRuleRead]:
        """Each rule with its match and who it notifies in words."""
        members = await Members.of(session, graph_id=graph_id)
        out = []
        for row in rows:
            match = AlertMatch.model_validate(row.match or {})
            read = AlertRuleRead.model_validate(row)
            read.match = match
            read.match_line = match_line(match)
            read.notify_line = ", ".join(members.usernames(list(row.notify_user_ids or [])))
            out.append(read)
        return out

    async def read(self, session: AsyncSession, row: AlertRule) -> AlertRuleRead:
        return (await self.reads(session, graph_id=row.graph_id, rows=[row]))[0]

    async def create(
        self, session: AsyncSession, *, graph: Graph, payload: AlertRuleCreate, actor_id: str | None
    ) -> AlertRule:
        """A new rule, starting at the Graph's head. 409 on a name the Graph already has."""
        if await self.rules_qs.by_name(session, graph_id=graph.id, name=payload.name) is not None:
            raise ConflictError(f"An alert rule named {payload.name!r} already exists.")
        members = await Members.of(session, graph_id=graph.id)
        row = await self.rules_qs.add(
            session,
            AlertRule(
                graph_id=graph.id,
                name=payload.name,
                enabled=payload.enabled,
                match=payload.match.model_dump(),
                notify_user_ids=members.ids(payload.notify_user_ids),
                last_seq=await self.rules_qs.head_seq(session, graph_id=graph.id),
                created_by_id=actor_id,
            ),
        )
        await self._emit(session, row, ALERT_RULE_CREATE, actor_id)
        return row

    async def update(
        self, session: AsyncSession, *, graph: Graph, rule_id: str, payload: AlertRuleUpdate, actor_id: str | None
    ) -> AlertRule:
        row = await self.get(session, graph=graph, rule_id=rule_id)
        changed = payload.model_dump(exclude_unset=True)
        if payload.name is not None and payload.name != row.name:
            if await self.rules_qs.by_name(session, graph_id=graph.id, name=payload.name) is not None:
                raise ConflictError(f"An alert rule named {payload.name!r} already exists.")
            row.name = payload.name
        if payload.enabled is not None:
            row.enabled = payload.enabled
        if payload.match is not None:
            row.match = payload.match.model_dump()
        if payload.notify_user_ids is not None:
            row.notify_user_ids = (await Members.of(session, graph_id=graph.id)).ids(payload.notify_user_ids)
        await session.flush()
        await self._emit(session, row, ALERT_RULE_UPDATE, actor_id, changed=sorted(changed))
        return row

    async def delete(self, session: AsyncSession, *, graph: Graph, rule_id: str, actor_id: str | None) -> None:
        row = await self.get(session, graph=graph, rule_id=rule_id)
        await self._emit(session, row, ALERT_RULE_DELETE, actor_id)
        await self.rules_qs.delete(session, row)

    async def evaluate(self, session: AsyncSession, *, now: datetime | None = None) -> int:
        """Match every enabled rule against the ledger rows after it; how many rules fired."""
        now = now or datetime.now(UTC)
        fired = 0
        for rule in await self.rules_qs.enabled_locked(session):
            rows = await self.rules_qs.rows_after(session, graph_id=rule.graph_id, seq=rule.last_seq)
            if not rows:
                continue
            match = AlertMatch.model_validate(rule.match or {})
            matched = [r for r in rows if row_matches(match, r)]
            head = rows[-1].seq
            rule.last_seq = head
            if not matched:
                continue
            count = len(matched)
            if match.threshold is not None:
                window = timedelta(seconds=match.threshold.window_s)
                if rule.last_fired_at is not None and rule.last_fired_at > now - window:
                    continue
                recent = await self.rules_qs.rows_since(
                    session, graph_id=rule.graph_id, since=now - window, through_seq=head
                )
                count = sum(1 for r in recent if row_matches(match, r))
                if count < match.threshold.count:
                    continue
            await self._fire(session, rule, match, count, now)
            fired += 1
        await session.flush()
        return fired

    async def _fire(self, session: AsyncSession, rule: AlertRule, match: AlertMatch, count: int, now: datetime) -> None:
        rule.last_fired_at = now
        acts = "1 matching act" if count == 1 else f"{count} matching acts"
        await self.inbox.tell(
            session,
            user_ids=list(rule.notify_user_ids or []),
            graph_id=rule.graph_id,
            kind=NotificationKind.event.value,
            title=f"Alert: {rule.name}"[:255],
            body=f"{acts} in the ledger — {match_line(match)}.",
            rule_id=rule.id,
            target_kind=TARGET_ALERT_RULE,
            target_id=rule.id,
        )

    async def _emit(self, session: AsyncSession, row: AlertRule, action: str, actor_id: str | None, **extra) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=TARGET_ALERT_RULE,
            target_id=row.id,
            graph_id=row.graph_id,
            actor_kind=ActorKind.user if actor_id else ActorKind.system,
            actor_id=actor_id,
            details={"name": row.name, "enabled": row.enabled, "match": row.match, **extra},
        )


async def evaluate_alert_rules(db: AsyncSession, *, now: datetime | None = None) -> int:
    """The clock's step: match every enabled rule against new ledger rows; how many fired."""
    return await AlertRuleManager().evaluate(db, now=now)
