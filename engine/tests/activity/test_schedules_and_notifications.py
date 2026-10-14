"""Schedules, notifications and approvals against a real Postgres
(docs/for-developers/modules/operate/features/schedules.md · notifications.md ·
approvals.md).

What is worth testing is the governance: a missed firing follows its policy and
is recorded, an outward send waits for a named approver and is never
auto-approved, a send reaches a real endpoint signed, and a rule turns an event
into an inbox row without matching its own deliveries.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import threading
from datetime import UTC, datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import ClassVar

import pytest
import pytest_asyncio

from invana.activity.managers import (
    ApprovalManager,
    ChannelManager,
    Clock,
    EventMatcher,
    InboxManager,
    NotificationRuleManager,
    ScheduleManager,
)
from invana.activity.models import ApprovalStatus, DeliveryStatus, FiringOutcome
from invana.activity.querysets import DeliveryQuerySet
from invana.activity.schemas import ChannelCreate, NotificationRuleWrite, ScheduleCreate
from invana.apps.graphs.models import GraphMember
from invana.core import cron
from invana.core.auth.models import User
from invana.core.errors import ConflictError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.runtime.models import RunStatus, TaskRun

pytestmark = pytest.mark.asyncio

schedules = ScheduleManager()
approvals = ApprovalManager()
channels = ChannelManager()
rules = NotificationRuleManager()
inbox = InboxManager()


class _Hook(BaseHTTPRequestHandler):
    received: ClassVar[list[tuple[bytes, str]]] = []

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        _Hook.received.append((body, self.headers.get("X-Invana-Signature", "")))
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


@pytest.fixture
def webhook():
    server = HTTPServer(("127.0.0.1", 0), _Hook)
    _Hook.received = []
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}/hook"
    server.shutdown()


@pytest_asyncio.fixture
async def other(session, graph) -> User:
    row = User(email="bo@example.com", username="bo", password_hash="x", first_name="Bo")
    session.add(row)
    await session.flush()
    session.add(GraphMember(graph_id=graph.id, user_id=row.id, roles=["contributor"]))
    await session.flush()
    return row


async def test_cron_reads_in_its_zone():
    after = datetime(2026, 10, 12, 7, 30, tzinfo=UTC)
    # 08:00 in Berlin is 06:00 UTC in October (CEST), so the next one is tomorrow.
    assert cron.next_fire("0 8 * * *", "Europe/Berlin", after=after) == datetime(2026, 10, 13, 6, 0, tzinfo=UTC)
    assert cron.next_fire("*/15 9-17 * * 1-5", "UTC", after=after) == datetime(2026, 10, 12, 9, 0, tzinfo=UTC)
    with pytest.raises(ValueError, match="minute"):
        cron.Cron.parse("61 * * * *")


async def test_a_schedule_refuses_what_cannot_fire(session, graph, user, agent):
    payload = ScheduleCreate(name="digest", agent="explorer", instructions="What changed?", cron="0 25 * * *")
    with pytest.raises(ValidationError, match="hour"):
        await schedules.create(session, graph=graph, payload=payload, actor_id=user.id)
    payload = ScheduleCreate(name="digest", agent="explorer", instructions="x", cron="0 8 * * *", channels=["nope"])
    with pytest.raises(ValidationError, match="No channel"):
        await schedules.create(session, graph=graph, payload=payload, actor_id=user.id)


async def test_missed_firings_catch_up_once_and_overlap_skips(session, graph, user, agent):
    row = await schedules.create(
        session,
        graph=graph,
        actor_id=user.id,
        payload=ScheduleCreate(name="hourly", agent="explorer", instructions="Anything new?", cron="0 * * * *"),
    )
    now = datetime.now(UTC).replace(minute=30, second=0, microsecond=0)
    row.next_fire_at = now - timedelta(hours=2, minutes=30)  # three occurrences missed

    opened = await schedules.fire_due(session, now=now)

    firings = await schedules.firings(session, graph=graph, ref=row.id)
    assert len(opened) == 1
    assert sorted(f.outcome for f in firings) == ["opened", "skipped", "skipped"]
    ran = next(f for f in firings if f.outcome == FiringOutcome.opened.value)
    assert ran.catch_up and ran.run_id == opened[0]
    assert row.next_fire_at > now

    # The catch-up run is still queued, so the next firing is skipped, saying why.
    await schedules.run_now(session, graph=graph, ref=row.id, actor_id=user.id)
    assert await schedules.fire_due(session, now=now) == []
    newest = (await schedules.firings(session, graph=graph, ref=row.id))[0]
    assert newest.outcome == FiringOutcome.skipped.value and "still going" in newest.reason


async def test_an_outward_delivery_waits_for_its_approver_and_goes_signed(session, graph, user, other, agent, webhook):
    channel = await channels.create(
        session,
        graph=graph,
        actor_id=user.id,
        payload=ChannelCreate(name="ops", kind="webhook", target=webhook, secret="s3cret"),
    )
    assert "s3cret" not in channel.target and channels.read(channel).ready
    row = await schedules.create(
        session,
        graph=graph,
        actor_id=user.id,
        payload=ScheduleCreate(
            name="digest", agent="explorer", instructions="Summarise.", cron="0 8 * * *", channels=["ops"]
        ),
    )
    await schedules.run_now(session, graph=graph, ref=row.id, actor_id=user.id)
    [run_id] = await schedules.fire_due(session, now=datetime.now(UTC))
    run = await session.get(TaskRun, run_id)
    run.status = RunStatus.succeeded.value
    await session.flush()

    assert await schedules.deliver_settled(session, now=datetime.now(UTC)) == 1
    page = await inbox.inbox(session, graph=graph, user=user)
    assert [n.kind for n in page.items] == ["approval", "delivery"] and page.approvals_waiting == 1
    [approval] = await approvals.list(session, graph=graph, mine=user)
    [delivery] = await DeliveryQuerySet().for_approval(session, approval_id=approval.id)
    assert delivery.status == DeliveryStatus.held.value

    with pytest.raises(PermissionDeniedError, match="owner"):
        await approvals.decide(session, graph=graph, approval_id=approval.id, user=other, approve=True)
    await approvals.decide(session, graph=graph, approval_id=approval.id, user=user, approve=True, note="ok")
    with pytest.raises(ConflictError, match="approved"):
        await approvals.decide(session, graph=graph, approval_id=approval.id, user=user, approve=False)

    done = await Clock().tick(session, now=datetime.now(UTC))
    assert done.sent == 1 and delivery.status == DeliveryStatus.sent.value
    [(body, signature)] = _Hook.received
    assert json.loads(body)["schedule"] == "digest"
    assert signature == "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()


async def test_an_approval_nobody_decides_expires_not_sent(session, graph, user):
    now = datetime.now(UTC)
    approval = await approvals.request(
        session,
        graph_id=graph.id,
        subject_kind="delivery",
        subject_id="f1",
        title="digest → ops",
        payload={},
        approver_ids=[user.id],
        deadline_s=3600,
        requested_by_id=user.id,
        now=now - timedelta(minutes=40),
    )
    assert await approvals.remind_due(session, now=now) == 1
    assert await approvals.remind_due(session, now=now) == 0  # once

    assert await approvals.expire_due(session, now=now + timedelta(hours=1)) == 1
    assert approval.status == ApprovalStatus.expired.value
    with pytest.raises(ConflictError, match="expired"):
        await approvals.decide(session, graph=graph, approval_id=approval.id, user=user, approve=True)
    kinds = [n.kind for n in (await inbox.inbox(session, graph=graph, user=user)).items]
    assert kinds[:2] == ["expired", "reminder"]


async def test_a_rule_turns_a_failed_run_into_an_inbox_row(session, graph, user):
    with pytest.raises(ValidationError, match="never matches"):
        await rules.create(
            session,
            graph=graph,
            actor_id=user.id,
            payload=NotificationRuleWrite(name="loop", events=["delivery.*"], requester=True),
        )
    await rules.create(
        session,
        graph=graph,
        actor_id=user.id,
        payload=NotificationRuleWrite(name="failed runs", events=["run.*"], match={"status": "failed"}, requester=True),
    )
    matcher = EventMatcher()
    assert await matcher.match_new(session, now=datetime.now(UTC)) == 0  # starts the cursor, after the rule
    for status in ("succeeded", "failed"):
        await emit_event(
            session,
            action=actions.THINKING_FINISH,
            target_kind=actions.TARGET_THINKING,
            target_id="r1",
            graph_id=graph.id,
            actor_id=user.id,
            details={"status": status},
        )
    assert await matcher.match_new(session, now=datetime.now(UTC)) == 2
    assert await matcher.match_new(session, now=datetime.now(UTC)) == 0  # the cursor moved

    page = await inbox.inbox(session, graph=graph, user=user, unread=True)
    assert [n.title for n in page.items] == ["failed runs: run.finish · failed"]
    assert await inbox.mark_read(session, graph=graph, user=user, ids=None) == 1
    assert (await inbox.inbox(session, graph=graph, user=user)).unread == 0
