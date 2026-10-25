"""The clock — everything that happens later, in one tick.

docs/for-developers/modules/operate/spec.md · features/notifications.md.
One ``tick(now)`` does, in order: fire due and queued schedules, deliver the
scheduled runs that settled, match new events against the rules, remind and
expire approvals, move publish reviews along (a settled preview asks for its
approval, a decided approval opens or ends the migration), send what is
pending, match the alert rules against new ledger rows, and re-verify each
Graph's ledger chain whose last check is ten minutes old. Each step is idempotent on a unique
key or a row lock, so a restart or a second engine process repeats nothing::

    run_ids = await Clock().tick(session, now=datetime.now(UTC))
    await session.commit()
    for run_id in run_ids:
        runtime.submit(run_id)   # runs open committed, then start
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.alerts import AlertRuleManager
from invana.activity.managers.approvals import ApprovalManager
from invana.activity.managers.delivery import DeliveryManager
from invana.activity.managers.ledger import LedgerManager
from invana.activity.managers.notifications import EventMatcher
from invana.activity.managers.publish_reviews import PublishReviewManager
from invana.activity.managers.schedules import ScheduleManager


@dataclass
class Tick:
    """What one tick did — logged, and what tests read."""

    run_ids: list[str] = field(default_factory=list)
    delivered: int = 0
    events: int = 0
    reminded: int = 0
    expired: int = 0
    sent: int = 0
    failed: int = 0
    #: Alert rules that fired.
    alerts: int = 0
    #: Graphs whose ledger chain was re-verified.
    verified: int = 0


class Clock:
    schedules = ScheduleManager()
    matcher = EventMatcher()
    approvals = ApprovalManager()
    deliveries = DeliveryManager()
    reviews = PublishReviewManager()
    alert_rules = AlertRuleManager()
    ledger = LedgerManager()

    async def tick(self, session: AsyncSession, *, now: datetime) -> Tick:
        done = Tick()
        done.run_ids = await self.schedules.fire_due(session, now=now)
        done.delivered = await self.schedules.deliver_settled(session, now=now)
        done.events = await self.matcher.match_new(session, now=now)
        done.reminded = await self.approvals.remind_due(session, now=now)
        done.expired = await self.approvals.expire_due(session, now=now)
        done.run_ids += await self.reviews.advance_due(session, now=now)
        done.sent, done.failed = await self.deliveries.send_pending(session, now=now)
        done.alerts = await self.alert_rules.evaluate(session, now=now)
        done.verified = await self.ledger.verify_due(session, now=now)
        return done
