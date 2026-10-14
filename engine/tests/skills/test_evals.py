"""Evals — a draft is replayed against fixed questions before it publishes.

Positive: an eval run over both sides replays each case as a child ask, the
draft side offered the draft's version; a failed hard check blocks publish and
a clean run lets it through, with the verdict on the publish event. A drift
pass at the eval-token ceiling settles paused without replaying. Negative: a
publish with no eval run over the draft, a judge pinned to the model under
test, an agent promoting an ask, and a starter set on a Graph with no model
are each refused.

The replays' own work — the model and the graph database — is not run here:
each settled child is written as the record a replay leaves (its status,
timing and emissions), and everything that reads it is the real path.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.llm_providers.models import LLMModel, LLMProvider, LLMProviderKind
from invana.apps.skills.schemas import SkillCreate, SkillVersionPublish
from invana.core.auth.models import User
from invana.core.errors import ConflictError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.models import Event
from invana.runtime.managers import EvalManager, SkillDraftManager
from invana.runtime.models import Emission, RunStatus, TaskRun
from tests.skills.drawn import draw

pytestmark = pytest.mark.asyncio

drafts = SkillDraftManager()
evals = EvalManager()

OPUS = "llm/anthropic-prod/claude-opus-5-5"


async def _offer(session: AsyncSession, graph: Graph) -> None:
    provider = LLMProvider(graph_id=graph.id, name="anthropic-prod", provider=LLMProviderKind.anthropic, guardrails={})
    session.add(provider)
    await session.flush()
    for model_id in ("claude-opus-5-5", "claude-haiku-4-5"):
        session.add(LLMModel(provider_id=provider.id, model_id=model_id, capabilities={}, pricing={}))
    await session.flush()


async def _skill_with_draft(session: AsyncSession, graph: Graph, user: User):
    skill = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Routes", content="List the routes."),
        actor_id=user.id,
        publish=True,
    )
    await drafts.write_draft(session, skill=skill, payload=SkillVersionPublish(content="List the routes by airline."))
    await draw(session, skill=skill)
    return skill


async def _settle(session: AsyncSession, run_id: str, *, cites: dict[str, bool]) -> None:
    """Write each replay as settled; a side in ``cites`` emits a cited table or nothing."""
    started = datetime.now(UTC) - timedelta(seconds=2)
    for child in (await session.execute(select(TaskRun).where(TaskRun.parent_run_id == run_id))).scalars():
        side = child.params["eval"]["side"]
        child.status, child.outcome = RunStatus.succeeded.value, "answered"
        child.started_at, child.finished_at = started, started + timedelta(milliseconds=400)
        if cites[side]:
            session.add(
                Emission(
                    run_id=child.id,
                    seq=0,
                    kind="table",
                    payload={"rows": [{"id": "LHR-JFK"}]},
                    citation={"query": "MATCH (r:Route) RETURN r", "record_count": 1},
                )
            )
    await session.flush()


async def test_a_failed_check_on_the_draft_blocks_publish_and_a_clean_run_lets_it_through(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    await _offer(session, graph)
    skill = await _skill_with_draft(session, graph, user)
    await evals.add_case(
        session,
        graph_id=graph.id,
        subject_kind="skill",
        subject_id=skill.id,
        question="Which routes leave LHR?",
        checks=[{"kind": "cites_records"}, {"kind": "max_tokens", "value": 1000}],
        actor_id=user.id,
    )

    run = await evals.open_run(
        session, graph_id=graph.id, subject_kind="skill", subject_id=skill.id, side="both", actor_id=user.id
    )
    children = await evals.case_runs(session, run_id=run.id)
    draft = await drafts.ensure_draft(session, skill=skill)
    by_side = {c.params["eval"]["side"]: c for c in children}
    assert set(by_side) == {"live", "draft"}
    assert by_side["draft"].params["eval"]["skill_version_id"] == draft.id
    assert by_side["live"].params["eval"]["skill_version_id"] == skill.current_version_id

    await _settle(session, run.id, cites={"live": True, "draft": False})
    scored = await evals.score(session, run_id=run.id, encryption_key="")
    assert scored.outcome == "blocked"
    assert scored.result["eval"]["sides"]["live"]["hard_passed"] == 2
    with pytest.raises(ConflictError) as refused:
        await drafts.publish(session, skill=skill, payload=SkillVersionPublish(), actor_id=user.id)
    assert refused.value.detail["error"] == "eval_failed"

    rerun = await evals.open_run(
        session, graph_id=graph.id, subject_kind="skill", subject_id=skill.id, side="both", actor_id=user.id
    )
    await _settle(session, rerun.id, cites={"live": True, "draft": True})
    assert (await evals.score(session, run_id=rerun.id, encryption_key="")).outcome == "clean"

    published = await drafts.publish(session, skill=skill, payload=SkillVersionPublish(), actor_id=user.id)
    assert published.version == 2
    event = (
        await session.execute(
            select(Event).where(Event.action == actions.SKILL_PUBLISH, Event.details["version"].as_integer() == 2)
        )
    ).scalar_one()
    assert event.details["eval"] == {"verdict": "clean", "eval_run_id": rerun.id, "warnings": []}


async def test_a_drift_pass_at_the_eval_ceiling_settles_paused(session: AsyncSession, graph: Graph, user: User) -> None:
    await _offer(session, graph)
    skill = await _skill_with_draft(session, graph, user)
    await evals.add_case(
        session,
        graph_id=graph.id,
        subject_kind="skill",
        subject_id=skill.id,
        question="Which routes leave LHR?",
        checks=[{"kind": "cites_records"}],
        actor_id=user.id,
    )
    await evals.put_budget(session, graph_id=graph.id, monthly_tokens=0, actor_id=user.id)

    (paused,) = await evals.drift(session, graph_id=graph.id, trigger="nightly")

    assert (paused.status, paused.detail) == (RunStatus.skipped.value, "paused: budget reached")
    assert await evals.case_runs(session, run_id=paused.id) == []


async def test_publish_without_an_eval_run_a_judge_on_the_subject_model_and_an_agent_promoting_are_refused(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    await _offer(session, graph)
    skill = await _skill_with_draft(session, graph, user)
    await evals.add_case(
        session,
        graph_id=graph.id,
        subject_kind="skill",
        subject_id=skill.id,
        question="Which routes leave LHR?",
        checks=[{"kind": "cites_records"}],
        actor_id=user.id,
    )

    with pytest.raises(ConflictError) as refused:
        await drafts.publish(session, skill=skill, payload=SkillVersionPublish(), actor_id=user.id)
    assert refused.value.detail["error"] == "eval_required"

    skill.current_version.model_pin = OPUS
    await session.flush()
    with pytest.raises(ValidationError) as judged:
        await evals.put_set(
            session,
            graph_id=graph.id,
            subject_kind="skill",
            subject_id=skill.id,
            actor_id=user.id,
            judge_model_pin=OPUS,
        )
    assert judged.value.detail["error"] == "judge_same_model"

    with pytest.raises(PermissionDeniedError):
        await evals.promote(
            session,
            graph_id=graph.id,
            run_id="any",
            subject_kind="skill",
            subject_id=skill.id,
            label="passing",
            actor_id=user.id,
            actor_kind="agent",
        )


async def test_a_starter_set_on_a_graph_with_no_model_is_refused_and_writes_no_case(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill = await _skill_with_draft(session, graph, user)

    with pytest.raises(ValidationError):
        await evals.propose(
            session, graph_id=graph.id, subject_kind="skill", subject_id=skill.id, actor_id=user.id, encryption_key=""
        )
    eval_set = await evals.get_set(session, graph_id=graph.id, subject_kind="skill", subject_id=skill.id)
    assert await evals.cases(session, eval_set=eval_set) == []
