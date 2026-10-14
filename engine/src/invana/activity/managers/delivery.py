"""Sending what is pending — the clock's last step.

docs/for-developers/modules/operate/features/notifications.md. Each
pending delivery is tried once per tick; three failures leave it ``failed`` with
the error and a ``delivery.fail`` event. A held delivery waits for its approval
and is never touched here.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.channels import ChannelManager
from invana.activity.models import DeliveryStatus
from invana.activity.querysets import DeliveryQuerySet
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event

MAX_ATTEMPTS = 3


class DeliveryManager:
    deliveries_qs = DeliveryQuerySet()
    channels = ChannelManager()

    async def send_pending(self, session: AsyncSession, *, now: datetime) -> tuple[int, int]:
        """Try every pending delivery once; ``(sent, failed for good)``."""
        sent = failed = 0
        for row in await self.deliveries_qs.pending(session):
            channel = await self.deliveries_qs.channel(session, channel_id=row.channel_id)
            error = "the channel was deleted" if channel is None else await self.channels.send(channel, row.payload)
            row.attempts += 1
            if not error:
                row.status, row.sent_at, row.error = DeliveryStatus.sent.value, now, ""
                sent += 1
                continue
            row.error = error
            if channel is None or row.attempts >= MAX_ATTEMPTS:
                row.status = DeliveryStatus.failed.value
                failed += 1
                await emit_event(
                    session,
                    action=actions.DELIVERY_FAIL,
                    target_kind=actions.TARGET_DELIVERY,
                    target_id=row.id,
                    graph_id=row.graph_id,
                    actor_kind=ActorKind.system,
                    details={"channel_id": row.channel_id, "attempts": row.attempts, "error": error},
                )
        await session.flush()
        return sent, failed
