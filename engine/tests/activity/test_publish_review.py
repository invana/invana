"""Publishing a model draft — additive at once, breaking through a review — against a real
Postgres (docs/for-developers/modules/connect-and-model/features/publish-review.md).

What is worth testing is the gate: a breaking draft never publishes directly,
a review needs an owner other than the requester, and a review moves from its
preview to an approval to the migration run that publishes it. The preview's
scan reads the graph database, so these tests set the preview by hand rather
than run it.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
import pytest_asyncio

from invana.activity.managers import ApprovalManager, PublishReviewManager
from invana.activity.models import Approval
from invana.apps.govern.models import Lens  # noqa: F401  (a run freezes the Graph's guardrails)
from invana.apps.graphs.models import GraphMember
from invana.apps.modeller.managers import PublishManager
from invana.apps.modeller.managers.publishing import classify
from invana.apps.modeller.schemas import ModelPublishRequest
from invana.apps.modeller.store import ModelStore
from invana.apps.modeller.versioner import Versioner
from invana.core.auth.models import User
from invana.core.errors import ConflictError, PermissionDeniedError, ValidationError
from invana.runtime.models import RunStatus, TaskRun

pytestmark = pytest.mark.asyncio

store = ModelStore()
publishing = PublishManager()
reviews = PublishReviewManager()
approvals = ApprovalManager()


@pytest_asyncio.fixture
async def model(session, graph):
    """``Routes`` published at 1.0.0 with airport(code) and city, and a draft cloned from it."""
    m = await store.create_graph_model(session, name="Routes", graph_id=graph.id)
    first = await store.create_version(session, model_id=m.id)
    await store.create_property_key(session, version_id=first.id, name="code")
    await store.create_node_type(
        session, version_id=first.id, name="airport", property_mappings=[{"property_key": "code"}]
    )
    await store.create_node_type(session, version_id=first.id, name="city")
    await session.flush()
    await Versioner(store).activate(session, version_id=first.id)
    await session.flush()
    active = await store.get_active_version(session, m.id)
    await store.create_version(session, model_id=m.id, based_on=active.version)
    await session.flush()
    return m


async def _draft(session, model):
    draft, _ = await publishing.draft_and_base(session, model=model)
    return draft


async def _drop_city(session, model) -> str:
    draft = await _draft(session, model)
    city = next(t for t in draft.node_types if t.name == "city")
    await store.delete_node_type(session, city.id)
    await session.flush()
    return draft.id


@pytest_asyncio.fixture
async def second_owner(session, graph) -> User:
    row = User(email="bo@example.com", username="bo", password_hash="x", first_name="Bo")
    session.add(row)
    await session.flush()
    session.add(GraphMember(graph_id=graph.id, user_id=row.id, roles=["owner"]))
    await session.flush()
    return row


async def test_classify_marks_removals_and_new_constraints_breaking_and_new_types_additive(session, model):
    draft = await _draft(session, model)
    await store.create_node_type(session, version_id=draft.id, name="runway")
    await session.flush()
    draft, base = await publishing.draft_and_base(session, model=model)
    first = classify(base, draft)
    assert first.classification == "additive"
    assert (first.added, first.changed, first.removed) == (1, 0, 0)

    await store.create_constraint(
        session,
        version_id=draft.id,
        name="airport_code_unique",
        target_kind="node_type",
        target_label="airport",
        constraint_type="unique",
        properties=["code"],
    )
    airport = next(t for t in draft.node_types if t.name == "airport")
    await store.delete_node_type(session, airport.id)
    await session.flush()
    draft, base = await publishing.draft_and_base(session, model=model)
    found = classify(base, draft)
    kinds = {c.kind for c in found.changes if c.breaking}
    assert found.classification == "breaking"
    assert {"type_removed", "constraint_added"} <= kinds
    assert "type_added" in {c.kind for c in found.changes if not c.breaking}
    assert found.added + found.changed + found.removed == len(found.changes)
    assert (found.added, found.changed, found.removed) == (2, 0, 1)


async def test_an_additive_draft_publishes_at_once(session, graph, user, model):
    draft = await _draft(session, model)
    await store.create_node_type(session, version_id=draft.id, name="runway")
    await session.flush()

    outcome, run_id = await reviews.publish(
        session, graph=graph, model=model, user=user, payload=ModelPublishRequest(why="add runways")
    )
    assert outcome.outcome == "published" and outcome.version == "1.1.0" and run_id is None


async def test_a_breaking_draft_is_refused_directly_and_needs_another_owner(session, graph, user, model):
    version_id = await _drop_city(session, model)

    with pytest.raises(ConflictError) as exc:
        await publishing.refuse_breaking(session, version_id=version_id)
    assert exc.value.detail["error"] == "breaking_publish_needs_review"

    with pytest.raises(ValidationError, match="owner other than you"):
        await reviews.publish(session, graph=graph, model=model, user=user, payload=ModelPublishRequest())


async def test_a_review_previews_then_waits_for_approval_then_migrates(session, graph, user, second_owner, model):
    await _drop_city(session, model)
    outcome, run_id = await reviews.publish(
        session, graph=graph, model=model, user=user, payload=ModelPublishRequest(why="cities move out")
    )
    review = outcome.review
    assert outcome.outcome == "review" and review.status == "previewing"
    assert review.approver_ids == [second_owner.id]
    preview = await session.get(TaskRun, run_id)
    assert preview.ask_kind == "model_migration" and preview.status == RunStatus.queued.value

    with pytest.raises(ConflictError):
        await reviews.publish(session, graph=graph, model=model, user=user, payload=ModelPublishRequest())

    # The scan reads the graph; what it would have recorded, set by hand.
    row = await reviews.get(session, model=model, review_id=review.id)
    row.preview = {"scan_limit": 1000, "types": [], "affected": 0, "would_fail": 0}
    preview.status = RunStatus.succeeded.value
    await session.flush()

    now = datetime.now(UTC)
    assert await reviews.advance_due(session, now=now) == []
    assert row.status == "pending"
    approval = await session.get(Approval, row.approval_id)
    assert approval.subject_kind == "model_publish" and approval.approver_ids == [second_owner.id]

    with pytest.raises(PermissionDeniedError):  # the requester is not an approver
        await approvals.decide(session, graph=graph, approval_id=approval.id, user=user, approve=True)
    await approvals.decide(session, graph=graph, approval_id=approval.id, user=second_owner, approve=True)
    [migration_id] = await reviews.advance_due(session, now=now)
    assert row.status == "migrating" and row.run_id == migration_id
    migration = await session.get(TaskRun, migration_id)
    assert migration.params["apply"] is True
