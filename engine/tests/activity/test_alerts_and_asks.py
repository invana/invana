"""Alert rules and the Waiting queue against a real Postgres
(docs/for-developers/modules/operate/features/approvals.md).

What is worth testing: an alert rule fires on a matching ledger row and not on
another, *For you* is what the reader may decide while *All* is every pending
ask, *Allow always* is refused on anything but a delegation, and a second
decision names who decided first.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
import pytest_asyncio
from sqlalchemy import select

from invana.activity.managers.alerts import AlertRuleManager
from invana.activity.managers.approvals import ApprovalManager
from invana.activity.models import Notification
from invana.activity.schemas import ALERT_RULE_LIST, APPROVAL_LIST, AlertMatch, AlertRuleCreate
from invana.apps.graphs.models import GraphMember
from invana.core import ledger
from invana.core.auth.models import User
from invana.core.errors import ConflictError, ValidationError
from invana.core.ledger.models import LedgerRow  # noqa: F401  (registers the ledger tables)
from invana.core.lists.params import parse_list_params

pytestmark = pytest.mark.asyncio

alerts = AlertRuleManager()
approvals = ApprovalManager()


@pytest_asyncio.fixture
async def other(session, graph) -> User:
    row = User(email="bo@example.com", username="bo", password_hash="x", first_name="Bo")
    session.add(row)
    await session.flush()
    session.add(GraphMember(graph_id=graph.id, user_id=row.id, roles=["contributor"]))
    await session.flush()
    return row


async def _inbox(session, user_id: str) -> list[Notification]:
    return list((await session.execute(select(Notification).where(Notification.user_id == user_id))).scalars())


async def test_an_alert_rule_fires_on_a_match_and_not_otherwise(session, graph, user, other):
    rule = await alerts.create(
        session,
        graph=graph,
        payload=AlertRuleCreate(
            name="An agent writes to Fare",
            match=AlertMatch(act="graph.write.*", touched="graph/Fare", verdict=["allowed"]),
            notify_user_ids=["bo"],
        ),
        actor_id=user.id,
    )
    page = await alerts.page(session, graph=graph, params=parse_list_params(ALERT_RULE_LIST, {}), applied=[])
    [read] = page.items
    assert page.total == 1 and read.match_line == "graph.write.* on Fare · allowed" and read.notify_line == "bo"

    read_row = await ledger.record(
        session,
        graph_id=graph.id,
        actor_kind="agent",
        act="graph.read.query",
        layer="graph",
        touched="graph/Fare",
        verdict="allowed",
    )
    assert await alerts.evaluate(session, now=datetime.now(UTC)) == 0
    assert rule.last_fired_at is None and rule.last_seq == read_row.seq

    write_row = await ledger.record(
        session,
        graph_id=graph.id,
        actor_kind="agent",
        act="graph.write.upsert",
        layer="graph",
        touched="graph/Fare:LHR-JFK",
        verdict="allowed",
    )
    assert await alerts.evaluate(session, now=datetime.now(UTC)) == 1
    assert rule.last_fired_at is not None and rule.last_seq == write_row.seq
    [told] = await _inbox(session, other.id)
    assert told.title == "Alert: An agent writes to Fare"


async def test_for_you_is_what_the_reader_decides_and_always_is_for_delegation(session, graph, user, other):
    common = {"graph_id": graph.id, "subject_id": "s", "payload": {}, "deadline_s": 3600, "requested_by_id": None}
    mine = await approvals.request(
        session, subject_kind="budget", title="More tokens", approver_ids=[user.id], kind="budget", **common
    )
    await approvals.request(
        session, subject_kind="access", title="Read Fare", approver_ids=[other.id], kind="access", **common
    )

    def view(name: str):
        return parse_list_params(APPROVAL_LIST, {"view": [name]})

    for_you = await approvals.page(session, graph=graph, params=view("for_you"), reader=user, applied=[])
    assert [a.title for a in for_you.items] == ["More tokens"] and for_you.items[0].can_decide
    assert for_you.for_you == 1 and for_you.pending == 2
    every = await approvals.page(session, graph=graph, params=view("all"), reader=user, applied=[])
    assert every.total == 2
    assert {a.title: a.can_decide for a in every.items} == {"More tokens": True, "Read Fare": False}

    with pytest.raises(ValidationError, match="delegation only"):
        await approvals.decide(session, graph=graph, approval_id=mine.id, user=user, approve=True, scope="always")
    await approvals.decide(session, graph=graph, approval_id=mine.id, user=user, approve=True)
    with pytest.raises(ConflictError) as twice:
        await approvals.decide(session, graph=graph, approval_id=mine.id, user=user, approve=False)
    assert twice.value.detail["decided_by"] == "owner" and twice.value.detail["decided_at"]
    assert twice.value.detail["message"].startswith("Already approved by owner at ")
    answered = await approvals.page(session, graph=graph, params=view("answered"), reader=user, applied=[])
    assert [a.decided_by_name for a in answered.items] == ["owner"]
