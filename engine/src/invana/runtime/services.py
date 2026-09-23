"""Opening, resuming, re-running and reading runs
(docs/for-developers/modules/ask/features/streaming-and-the-workflow.md).

These write the rows a run needs **before** the runtime starts (the route
commits, then submits), so a subscriber that connects immediately sees the plan
— the queued step rows — from the record. Nothing here executes a task.
"""

from __future__ import annotations

from dataclasses import dataclass
from http import HTTPStatus
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.envelope import PlanStep
from invana.apps.agents.managers import AgentManager
from invana.apps.agents.models import Agent
from invana.apps.govern.managers import LensManager, LLMEndpointManager, NoEndpointError
from invana.apps.govern.managers.lens import to_effective
from invana.apps.govern.rules import compose, from_snapshot
from invana.apps.graphs.managers import GraphManager
from invana.apps.graphs.models import Graph
from invana.apps.llm_providers.endpoint import LLMEndpoint
from invana.apps.llm_providers.managers import LLMProviderManager
from invana.apps.modeller.store import ModelStore
from invana.apps.sessions.models import (
    Session,
    SessionMessage,
    SessionMessageRole,
    SessionMessageStatus,
    SessionSurface,
)
from invana.apps.sessions.querysets import SessionMessageQuerySet
from invana.apps.sessions.schemas import SendMessage
from invana.apps.sessions.transcript import _title_from_text
from invana.apps.task_plans.models import TaskPlan
from invana.apps.work.models import Task
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import current_trace_id, emit_event
from invana.core.settings import settings
from invana.runtime.catalogue.records import LoadRefused
from invana.runtime.models import RunRole, RunStatus, TaskRun, TriggeredBy
from invana.runtime.planning import opening_for, plan_payload, queue_plan_steps, select_plan_by_key
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.workflows import MODELLER_GENERATE, NL_QUERY, QL_QUERY, WORKFLOWS, Workflow


def stream_url(username: str, graph_slug: str, run_id: str) -> str:
    return f"/api/v1/u/{username}/{graph_slug}/runs/{run_id}/stream"


def _queue_steps(db: AsyncSession, th: TaskRun, message_id: str, wf: Workflow, *, start: int = 0) -> None:
    for i in range(start, len(wf.steps)):
        step = wf.steps[i]
        db.add(
            TaskRun(
                graph_id=th.graph_id,
                parent_run_id=th.id,
                message_id=message_id,
                seq=i,
                step_key=step.task_key,
                task_key=step.task_key,
                label=step.label,
                attempt=1,
                status=RunStatus.queued.value,
            )
        )


def _queue_opening(db: AsyncSession, th: TaskRun, message_id: str | None, opening) -> None:
    """The rows a run opens with.

    For a static agent that is the whole workflow, before any LLM call. For a
    planning one it is *Understand* and *Plan* alone — the rest appear when the
    plan lands, which is the difference the user actually sees (docs/for-developers/modules/agents/spec.md).
    """
    for i, step in enumerate(opening.steps):
        db.add(
            TaskRun(
                graph_id=th.graph_id,
                parent_run_id=th.id,
                message_id=message_id,
                seq=i,
                step_key=step.id,
                task_key=step.task,
                label=step.label,
                args=step.args or None,
                attempt=1,
                status=RunStatus.queued.value,
            )
        )


async def _next_attempt(db: AsyncSession, run_id: str, seq: int) -> int:
    prior = (
        (
            await db.execute(
                select(TaskRun.attempt)
                .where(TaskRun.parent_run_id == run_id, TaskRun.seq == seq)
                .order_by(TaskRun.attempt.desc())
            )
        )
        .scalars()
        .first()
    )
    return (prior or 0) + 1


async def _prune(db: AsyncSession, graph_id: str) -> None:
    """Keep the newest ``INVANA_RUN_HISTORY_LIMIT`` runs per graph
    (docs/for-developers/modules/ask/spec.md)."""
    limit = settings.run_history_limit
    if limit <= 0:
        return
    keep = select(TaskRun.id).where(TaskRun.graph_id == graph_id).order_by(TaskRun.queued_at.desc()).limit(limit)
    await db.execute(delete(TaskRun).where(TaskRun.graph_id == graph_id, TaskRun.id.not_in(keep)))


async def open_turn(
    db: AsyncSession,
    *,
    sess: Session,
    graph: Graph,
    payload: SendMessage,
    actor_id: str,
) -> tuple[SessionMessage, SessionMessage, TaskRun]:
    """Record the ask: user + assistant rows, a queued TaskRun carrying it, and its node rows.

    Config failures (no provider, query mode on a modeller session) raise before
    anything is written, exactly as the synchronous path did.
    """
    is_modeller = sess.surface == SessionSurface.modeller
    if is_modeller and payload.mode == "ql":
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail="Modeller sessions author a model — query mode isn't available here.",
        )

    # **The agent decides the provider** (docs/for-developers/modules/agents/spec.md). The composer no longer
    # sends one; a session bound before agents existed falls back to its
    # surface's seeded agent rather than failing.
    agent = await _session_agent(db, sess=sess, graph=graph)
    # One composition, read twice: the lens this run is frozen under is the same
    # lens its model is cast by, so *which model answered* and *what it was
    # allowed to see* cannot disagree ([PM14](docs/for-developers/modules/agents/features/providers-and-models.md)).
    frozen = await freeze_lens(db, graph_id=graph.id, agent_id=agent.id if agent else None, lens_id=payload.lens_id)
    needs_provider = is_modeller or payload.mode == "nl"
    provider = (
        await resolve_endpoint(
            db,
            graph_id=graph.id,
            snapshot=frozen["lens_snapshot"],
            prefer_model_row_id=payload.llm_model_id,
        )
        if needs_provider
        else None
    )
    opening = opening_for(agent, ask_kind=payload.mode) if agent is not None else None
    wf = MODELLER_GENERATE if is_modeller else (NL_QUERY if payload.mode == "nl" else QL_QUERY)

    messages_qs = SessionMessageQuerySet()
    user_seq = await messages_qs.next_seq(db, session_id=sess.id)
    user_msg = SessionMessage(session_id=sess.id, seq=user_seq, role=SessionMessageRole.user, content=payload.content)
    assistant_msg = SessionMessage(
        session_id=sess.id,
        seq=user_seq + 1,
        role=SessionMessageRole.assistant,
        content="Generating model…" if is_modeller else "Running query…",
        status=SessionMessageStatus.running,
        mode="nl" if is_modeller else payload.mode,
        timeout_s=payload.timeout_s,
    )
    await messages_qs.add(db, user_msg)
    await messages_qs.add(db, assistant_msg)

    # The ask is columns on the run it opened, not a row of its own: every root
    # run had exactly one Thought, and two rows for one fact is a join every
    # reader had to know about (task-model-migration §7b).
    th = TaskRun(
        graph_id=graph.id,
        session_id=sess.id,
        message_id=user_msg.id,
        author_id=actor_id,
        ask_kind="nl" if is_modeller else payload.mode,
        body=payload.content,
        params={
            "language": payload.language.value if payload.language else None,
            # The `llm_models` row, because it resolves both address segments —
            # a provider id resolves neither ([PM15]).
            "llm_model_id": provider.model_row_id if provider else None,
            "timeout_s": payload.timeout_s,
            "parameters": payload.parameters,
        },
        workflow_key=wf.key,
        assistant_message_id=assistant_msg.id,
        agent_id=agent.id if agent else None,
        agent_version=agent.version if agent else None,
        triggered_by=TriggeredBy.user.value,
        on_behalf_of_user_id=actor_id,
        **frozen,
    )
    db.add(th)
    await db.flush()
    assistant_msg.run_id = th.id
    if opening is not None:
        _queue_opening(db, th, assistant_msg.id, opening)
    else:
        _queue_steps(db, th, assistant_msg.id, wf)

    sess.message_count += 2
    sess.last_status = assistant_msg.status
    if not sess.title:
        sess.title = _title_from_text(payload.content)
    await _prune(db, graph.id)
    await db.flush()
    return user_msg, assistant_msg, th


_lenses = LensManager()
_endpoints = LLMEndpointManager()
_agents = AgentManager()


async def freeze_lens(
    db: AsyncSession,
    *,
    graph_id: str,
    agent_id: str | None,
    lens_id: str | None,
) -> dict:
    """Resolve the lens this run is dispatched under, and **freeze it**.

    ``effective = agent ∩ plan ∩ todo``
    ([GV6](docs/for-developers/modules/govern/spec.md)), composed once at run
    open and never recomputed
    ([GV8](docs/for-developers/modules/govern/spec.md)) — which is what makes
    ``lens_snapshot`` reconstructible rather than a pointer at rows that have
    since moved. A guardrail tightened tomorrow does not rewrite what this run
    was allowed to rest on
    ([GR3](docs/for-developers/modules/govern/features/guardrails.md)).

    The Graph's guardrails and the agent's go in whether or not a world was
    picked, because they are in force on every run whatever world it is asked
    under. **No world is the widest**, not the narrowest
    ([GV7](docs/for-developers/modules/govern/spec.md)): a Graph with nothing
    set freezes an empty lens, which permits everything.

    Returns the two columns as keyword arguments, so a caller that opens a run
    spreads it into the constructor rather than remembering two field names.
    """
    contributors = [await _lenses.effective_guardrails(db, graph_id=graph_id, agent_id=agent_id)]

    # The agent's own world, the third of its three bounds
    # ([AG2](docs/for-developers/modules/agents/features/author-an-agent.md)). It
    # composes whether or not the asker picked one, for the same reason the
    # guardrails do: it is in force on every run this agent opens, and an agent
    # bound to a world that only narrowed the runs somebody remembered to pick
    # it for would not be bound at all. A child carries its parent's
    # ([DG9](docs/for-developers/modules/agents/features/delegation.md)), so the
    # narrowing travels down the tree with no second mechanism.
    if agent_id:
        agent = await _agents.agents_qs.get(db, agent_id)
        if agent is not None and agent.lens_id:
            own = await _lenses.lenses_qs.get(db, agent.lens_id)
            if own is not None:
                contributors.append(to_effective(own))

    world = None
    if lens_id:
        # A world that is not this Graph's raises, before the run is written —
        # a run that opened under nothing while its asker believed otherwise is
        # the one outcome the whole module exists to prevent.
        world = await _lenses.get(db, lens_id=lens_id, graph_id=graph_id)
        contributors.append(to_effective(world))

    return {
        "lens_id": world.id if world else None,
        "lens_snapshot": compose(contributors).as_snapshot(),
    }


async def _session_agent(db: AsyncSession, *, sess: Session, graph: Graph) -> Agent | None:
    """The agent this thread thinks through, and the guard that goes with it.

    A paused or retired agent is a 409, not a silent fallback: running the ask
    through a different mind than the header names would be the worst possible
    resolution of the conflict (docs/for-developers/modules/agents/spec.md).
    """
    surface = sess.surface.value if isinstance(sess.surface, SessionSurface) else str(sess.surface)
    if sess.agent_id:
        return await AgentManager().require_available(db, agent_id=sess.agent_id, graph_id=graph.id)
    agent = await AgentManager().default_agent_for_surface(db, graph=graph, surface=surface)
    if agent is not None:
        # Bind it now, so the header and the next ask agree.
        sess.agent_id = agent.id
    return agent


async def resolve_endpoint(
    db: AsyncSession,
    *,
    graph_id: str,
    snapshot: dict | None,
    prefer_model_row_id: str | None = None,
) -> LLMEndpoint:
    """The model this run calls, resolved through the lens it was frozen under.

    One path and no fallbacks
    ([PM14](docs/for-developers/modules/agents/features/providers-and-models.md)):
    the cast picks, the lens checks, and a Graph that casts nothing gets the
    shipped cast over the models it offers. A Graph offering none is the 422
    that routes a person to Agents → LLMs, raised before anything is written.
    """
    return await _endpoints.resolve(
        db,
        graph_id=graph_id,
        effective=from_snapshot(snapshot) if snapshot else None,
        prefer_model_row_id=prefer_model_row_id,
    )


async def endpoint_for_run(db: AsyncSession, *, th: TaskRun) -> LLMEndpoint | None:
    """The endpoint a run recorded, else the one its frozen lens resolves.

    ``params.llm_model_id`` is what a run opened after the split carries; a run
    queued before it carries ``llm_provider_id``, which resolves to that
    provider's first offered model for one release ([PM15]). Neither present —
    a Task's run, a delegation — and the frozen lens answers, which is the same
    resolution the ask took, re-read rather than re-decided.

    **``None`` when the Graph offers no model**, rather than a refusal: a ``ql``
    run calls none, and killing it over configuration it never needed would be
    the wrong failure. The refusal for a run that *does* need one is raised at
    open, where it can route somebody to Agents → LLMs. A cast the lens
    **denies** still raises here — that is a governed refusal, not a gap.
    """
    params = th.params or {}
    if params.get("llm_model_id"):
        found = await _endpoints.models_qs.endpoint_by_model_row(db, params["llm_model_id"])
        if found is not None:
            return found
    if params.get("llm_provider_id"):
        legacy = await LLMProviderManager().llm_providers_qs.get(db, params["llm_provider_id"])
        if legacy is not None and legacy.graph_id == th.graph_id:
            return await LLMProviderManager().first_endpoint(db, provider=legacy)
    try:
        return await resolve_endpoint(db, graph_id=th.graph_id, snapshot=th.lens_snapshot)
    except NoEndpointError:
        return None


async def open_todo_run(
    db: AsyncSession,
    *,
    graph: Graph,
    task,
    agent: Agent,
    on_behalf_of_user_id: str,
    body: str | None = None,
    parent_run_id: str | None = None,
) -> TaskRun:
    """Open the one run an assignment (or a delegation) opens.

    There is no session and no assistant message here — a Task is not a
    conversation. Everything else is identical to a session ask, which is the
    point: the trace of a task and the trace of a question are the same shape
    (R1, R3).

    A task-triggered run starts at **Plan**: the task body already *is* an
    intent, so there is nothing for *Understand* to settle (docs/for-developers/modules/agents/spec.md).
    """
    triggered = TriggeredBy.delegation.value if parent_run_id else TriggeredBy.task.value
    th = TaskRun(
        graph_id=graph.id,
        author_id=on_behalf_of_user_id,
        author_kind="user",
        ask_kind="nl",
        body=body if body is not None else task.body or task.title,
        params={"acceptance": task.acceptance or None},
        workflow_key=NL_QUERY.key,
        agent_id=agent.id,
        agent_version=agent.version,
        triggered_by=triggered,
        # **A Todo, not a plan node.** `task_id` names the node a run executes;
        # what a person wrote down is `todo_id`, and the two were one word until
        # M2 split them (task-model-migration §2.1).
        todo_id=task.id,
        # The delegating **node** is the parent. A node is a run, so the chain is
        # one edge — which is why `delegated_by_step_id` and `child_run_id` are
        # both gone: they described this same edge from the other two directions.
        parent_run_id=parent_run_id,
        on_behalf_of_user_id=on_behalf_of_user_id,
        # A Task's run is bounded like any other ([GV26]). There is no composer
        # to pick a world from, so it freezes the guardrails and the agent's own
        # lens — which is what *no world is the widest, not the narrowest*
        # means for a run nobody was watching open ([GV7]).
        **await freeze_lens(db, graph_id=graph.id, agent_id=agent.id, lens_id=None),
    )
    db.add(th)
    await db.flush()
    _queue_opening(db, th, None, opening_for(agent, ask_kind="nl"))
    await emit_event(
        db,
        action=actions.THINKING_OPEN,
        target_kind=actions.TARGET_THINKING,
        target_id=th.id,
        graph_id=graph.id,
        project_id=task.project_id,
        task_id=task.id,
        run_id=th.id,
        actor_kind=ActorKind.agent,
        actor_id=agent.id,
        on_behalf_of_user_id=on_behalf_of_user_id,
        details={"actor_name": agent.name, "parent_run_id": parent_run_id},
        trace_id=current_trace_id(),
    )
    await db.flush()
    return th


async def open_draft_run(
    db: AsyncSession,
    *,
    graph: Graph,
    version,
    skill_name: str,
    agent: Agent,
    actor_id: str,
) -> TaskRun:
    """The run that draws a skill's playbook — the first ``role = plan`` run.

    One node, ``draft_plan``, against the draft's id. It is an ordinary run for
    every other purpose: it takes a slot, it records its exchange, it appears in
    Runs, and what it did is readable months later
    ([SK23](docs/for-developers/modules/skills/features/authoring-a-skill.md)).

    ``workflow_key`` names the act rather than a `WORKFLOWS` entry — the loop
    reads its steps from the queued rows, and the three keys left in that dict
    are what a *session* opens against (task-model-migration § 6.5).
    """
    th = TaskRun(
        graph_id=graph.id,
        author_id=actor_id,
        author_kind="user",
        ask_kind="nl",
        role=RunRole.plan.value,
        body=f"Draw “{skill_name}” as a plan",
        workflow_key="skill-draft",
        # Which draft this run is drawing, on the **root** as well as on the
        # step's args: the authoring surface asks *is a draw in flight for this
        # draft* on every read, and a draw has to be recognisable after a
        # reload — the draft is a row, and so is the run drawing it (SK20).
        params={"skill_version_id": version.id},
        agent_id=agent.id,
        agent_version=agent.version,
        triggered_by=TriggeredBy.user.value,
        on_behalf_of_user_id=actor_id,
        # A draw spends a model call, so it is bounded like every other run
        # ([GV26]): the guardrails and the agent's lens, frozen at open.
        **await freeze_lens(db, graph_id=graph.id, agent_id=agent.id, lens_id=None),
    )
    db.add(th)
    await db.flush()
    db.add(
        TaskRun(
            graph_id=graph.id,
            parent_run_id=th.id,
            seq=0,
            step_key="draft_plan",
            task_key="draft_plan",
            label="Draw",
            args={"skill_version_id": version.id},
            attempt=1,
            status=RunStatus.queued.value,
        )
    )
    await db.flush()
    await emit_event(
        db,
        action=actions.THINKING_OPEN,
        target_kind=actions.TARGET_THINKING,
        target_id=th.id,
        graph_id=graph.id,
        run_id=th.id,
        actor_id=actor_id,
        details={"role": RunRole.plan.value, "skill": skill_name, "skill_version_id": version.id},
        trace_id=current_trace_id(),
    )
    await db.flush()
    return th


async def resume_turn(
    db: AsyncSession,
    *,
    sess: Session,
    run: TaskRun,
    answer: str,
) -> tuple[SessionMessage, SessionMessage]:
    """Answer a clarification: the same run continues from its cursor under a new reply row (UC7)."""
    if run.status != RunStatus.awaiting_input.value:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail={"error": "not_awaiting_input", "message": "This run isn't waiting for an answer."},
        )
    wf = _workflow(run)
    start = int((run.cursor or {}).get("step", 0))
    messages_qs = SessionMessageQuerySet()
    user_seq = await messages_qs.next_seq(db, session_id=sess.id)
    user_msg = SessionMessage(session_id=sess.id, seq=user_seq, role=SessionMessageRole.user, content=answer)
    prev = await db.get(SessionMessage, run.assistant_message_id) if run.assistant_message_id else None
    assistant_msg = SessionMessage(
        session_id=sess.id,
        seq=user_seq + 1,
        role=SessionMessageRole.assistant,
        content="Generating model…" if wf.key == MODELLER_GENERATE.key else "Running query…",
        status=SessionMessageStatus.running,
        mode="nl",
        timeout_s=prev.timeout_s if prev else None,
        run_id=run.id,
    )
    await messages_qs.add(db, user_msg)
    await messages_qs.add(db, assistant_msg)
    run.assistant_message_id = assistant_msg.id
    run.status = RunStatus.queued.value
    run.finished_at = None
    for i in range(start, len(wf.steps)):
        step = wf.steps[i]
        db.add(
            TaskRun(
                graph_id=run.graph_id,
                parent_run_id=run.id,
                message_id=assistant_msg.id,
                seq=i,
                task_key=step.task_key,
                label=step.label,
                attempt=await _next_attempt(db, run.id, i),
                status=RunStatus.queued.value,
            )
        )
    sess.message_count += 2
    sess.last_status = assistant_msg.status
    await db.flush()
    return user_msg, assistant_msg


async def rerun_turn(
    db: AsyncSession,
    *,
    sess: Session,
    graph: Graph,
    message: SessionMessage,
    actor_id: str,
) -> TaskRun:
    """Re-run a reply's query in place: a new ``ql-query`` run on the same run_ask, writing the same row."""
    if not message.source_query:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail={"error": "no_source_query", "message": "Message has no query to re-run."},
        )
    # A rerun is a new run asking the same thing, and the thing it asks is the
    # **stored query** — never the prior run's body. An `nl` run's body is the
    # question, and `ql-query` has no translate step to turn one back into a
    # query, so copying it sends English to the driver. The ambient settings
    # (language, timeout, provider) are still the ones that answered before, or
    # the message's own for a reply older than the runtime.
    prev = await TaskRunQuerySet().get(db, message.run_id) if message.run_id else None
    prior_lens_id = prev.lens_id if prev else None
    if prior_lens_id is not None and await _lenses.lenses_qs.get(db, prior_lens_id) is None:
        # Refused rather than re-run wide. A re-run whose world has been deleted
        # since cannot honestly be a re-run: answering the same question under a
        # broader lens is a different question, and silently widening is the one
        # outcome [GV26] exists to prevent.
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail={
                "error": "world_deleted",
                "message": "The world this answer was asked under has been deleted, so it cannot be re-run under it.",
            },
        )
    th = TaskRun(
        graph_id=graph.id,
        session_id=sess.id,
        author_id=actor_id,
        ask_kind="ql",
        body=message.source_query,
        params=(
            prev.params
            if prev and prev.params
            else {"language": message.query_language, "timeout_s": message.timeout_s}
        ),
        workflow_key=QL_QUERY.key,
        assistant_message_id=message.id,
        # A re-run is a new run, so it freezes anew rather than copying a
        # snapshot ([GV26]) — but it re-runs under the **world it was asked
        # under**, because a re-run that quietly widened would answer a
        # different question than the one being re-asked.
        **await freeze_lens(
            db,
            graph_id=graph.id,
            agent_id=sess.agent_id,
            lens_id=prior_lens_id,
        ),
    )
    db.add(th)
    await db.flush()
    # The runtime reads the ask from the user row before the reply; a re-run
    # asks the stored query, so pin it on the run_ask params the loop reads.
    message.run_id = th.id
    message.status = SessionMessageStatus.running
    # Swap this message's contribution to the session's totals back out; the run adds the new counts.
    sess.node_count -= message.node_count or 0
    sess.edge_count -= message.edge_count or 0
    message.node_count = None
    message.edge_count = None
    _queue_steps(db, th, message.id, QL_QUERY)
    if message.seq == sess.message_count:
        sess.last_status = message.status
    await db.flush()
    return th


def _workflow(th: TaskRun) -> Workflow:
    return WORKFLOWS[th.workflow_key]


async def awaiting_run(db: AsyncSession, *, sess: Session) -> TaskRun | None:
    """The session's newest reply's run, when it is waiting for an answer."""
    last = (
        await db.execute(
            select(SessionMessage)
            .where(SessionMessage.session_id == sess.id, SessionMessage.role == SessionMessageRole.assistant)
            .order_by(SessionMessage.seq.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if last is None or not last.run_id:
        return None
    th = await TaskRunQuerySet().get(db, last.run_id)
    if th is not None and th.status == RunStatus.awaiting_input.value:
        return th
    return None


async def get_run_or_404(db: AsyncSession, *, run_id: str, graph_id: str, user_id: str) -> TaskRun:
    th = await TaskRunQuerySet().get(db, run_id)
    if th is None or th.graph_id != graph_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="TaskRun not found.")
    # The ask lives on the run, so the session it belongs to is one hop, not two.
    sess = await db.get(Session, th.session_id) if th.session_id else None
    # TaskRuns are as private as the session they belong to.
    if sess is not None and sess.created_by_id != user_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="TaskRun not found.")
    return th


async def list_steps(db: AsyncSession, *, run_id: str) -> list[TaskRun]:
    return list(
        (
            await db.execute(
                select(TaskRun).where(TaskRun.parent_run_id == run_id).order_by(TaskRun.seq, TaskRun.attempt)
            )
        ).scalars()
    )


async def steps_for_messages(db: AsyncSession, messages: list[SessionMessage]) -> dict[str, list[TaskRun]]:
    """Each reply's steps — from its **current** run only (a re-run replaces the list)."""
    wanted = {m.id: m.run_id for m in messages if m.run_id}
    if not wanted:
        return {}
    rows = (
        await db.execute(
            select(TaskRun).where(TaskRun.message_id.in_(list(wanted))).order_by(TaskRun.seq, TaskRun.attempt)
        )
    ).scalars()
    out: dict[str, list[TaskRun]] = {}
    for r in rows:
        if r.message_id and wanted.get(r.message_id) == r.parent_run_id:
            out.setdefault(r.message_id, []).append(r)
    return out


async def cancel_waiting(db: AsyncSession, *, run: TaskRun) -> None:
    """Cancel a run that is parked on a clarification (nothing is running)."""
    run.status = RunStatus.cancelled.value
    for row in await list_steps(db, run_id=run.id):
        if row.status in {RunStatus.queued.value, RunStatus.needs_input.value}:
            row.status = RunStatus.stopped.value
    await db.flush()


async def list_runs(
    db: AsyncSession,
    *,
    graph_id: str,
    agent_id: str | None = None,
    task_id: str | None = None,
    kind: str | None = None,
    candidates: bool = False,
    limit: int = 50,
) -> tuple[list[dict], int]:
    """TaskRuns as list rows, newest first (docs/for-developers/modules/agents/spec.md,
    docs/for-developers/modules/work/spec.md J3/J6).

    Two callers, one query. The Agent surface asks *what has this agent run?*;
    the Workflows library asks *which generated plans served and were never
    promoted?* — its **candidates**. Both want the plan and its verdict and
    neither wants the steps, so the steps are not loaded.

    **Roots only** (SR43). A step is not a journal row: it belongs to its run and
    is read through that run's trace. This was enforced only as a side effect —
    ``ask_kind`` is null on a child, so naming a ``kind`` already named a root —
    and the journal names no kind, so it listed every step row in the Graph. The
    filter is stated here now, because a rule that holds only while an unrelated
    filter is applied is not being enforced.

    ``kind`` is the journal's filter — *what ran* asked of one kind of work
    (task-model-migration § 6.7).

    ``candidates=True`` is the narrower of the two and is defined negatively on
    purpose: a candidate is a plan the engine *generated* (never one a template
    produced — that shape is already in the library), that Verify said **served**,
    and that no library entry claims as its origin. Anything looser would offer
    a person a list of plans to promote that are already promoted, or that
    nobody verified.
    """
    # A root is what a person or a schedule opened; everything else is a node of
    # one of them (SR43).
    stmt = select(TaskRun).where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_(None))
    if agent_id:
        stmt = stmt.where(TaskRun.agent_id == agent_id)
    if task_id:
        stmt = stmt.where(TaskRun.todo_id == task_id)
    if kind:
        stmt = stmt.where(TaskRun.ask_kind == kind)
    if candidates:
        # `generated` only: a run off a template is the library entry already.
        # And it must *have* a plan — promotion copies that document into the
        # entry, so a run whose plan was never recorded is not promotable, and
        # offering it would hand a person a button that always fails.
        stmt = stmt.where(TaskRun.plan_origin == "generated", TaskRun.plan_snapshot.isnot(None))
    rows = list((await db.execute(stmt.order_by(TaskRun.queued_at.desc()).limit(limit))).scalars())
    if not rows:
        return [], 0

    ids = [r.id for r in rows]

    # Verify's verdict lives on the step, not the run — the same single
    # definition of *served* the library's rate is computed from.
    verdicts: dict[str, str] = {}
    steps = list(
        (
            await db.execute(
                select(
                    TaskRun.parent_run_id,
                    TaskRun.task_key,
                    TaskRun.output,
                    TaskRun.tokens_in,
                    TaskRun.tokens_out,
                ).where(TaskRun.parent_run_id.in_(ids))
            )
        ).all()
    )
    counts: dict[str, int] = {}
    # What each run spent, rolled up from its tasks — the journal row's second
    # line reads it, and a per-row trace fetch would be 50 requests for a list
    # (SR45). The same roll-up `result.json` defines (SR39).
    tokens: dict[str, list[int]] = {}
    for run_id, task_key, output, tokens_in, tokens_out in steps:
        counts[run_id] = counts.get(run_id, 0) + 1
        spend = tokens.setdefault(run_id, [0, 0])
        spend[0] += tokens_in or 0
        spend[1] += tokens_out or 0
        if task_key == "verify_result":
            served = (output or {}).get("served")
            if isinstance(served, str):
                verdicts[run_id] = served

    # Where each run has got to: the furthest step by seq, and how many have
    # finished. A board row says "Execute 5/7", which is a *position*, not a
    # percentage — a plan can replan, and a bar that goes backwards is worse
    # than no bar.
    progress: dict[str, dict] = {}
    for run_id, seq, label, step_status in (
        await db.execute(
            select(TaskRun.parent_run_id, TaskRun.seq, TaskRun.label, TaskRun.status).where(
                TaskRun.parent_run_id.in_(ids)
            )
        )
    ).all():
        entry = progress.setdefault(run_id, {"seq": -1, "label": None, "done": 0, "total": 0})
        entry["total"] = max(entry["total"], seq + 1)
        if step_status == RunStatus.succeeded.value:
            entry["done"] += 1
        # The furthest step that is not merely queued is the one to name.
        if step_status != RunStatus.queued.value and seq > entry["seq"]:
            entry["seq"] = seq
            entry["label"] = label

    promoted = {
        row
        for (row,) in (
            await db.execute(select(TaskPlan.promoted_from_run_id).where(TaskPlan.promoted_from_run_id.in_(ids)))
        ).all()
        if row
    }

    titles: dict[str, str] = {}
    task_ids = [r.todo_id for r in rows if r.todo_id]
    if task_ids:
        titles = dict((await db.execute(select(Task.id, Task.title).where(Task.id.in_(task_ids)))).all())

    items = [
        {
            "id": r.id,
            "workflow_key": r.workflow_key,
            "status": r.status,
            # What kind of work, and what it was about. A journal row has to say
            # *what changed my graph* without a second request, and for a load
            # that is the body — "Import news-tv" (§ 6.7).
            "kind": r.ask_kind,
            "body": r.body,
            "plan_origin": r.plan_origin,
            "plan_revision": r.plan_revision,
            "replans": r.replans,
            "agent_id": r.agent_id,
            # What the run was *for* — the journal's `role` filter (SR10).
            "role": r.role,
            "task_id": r.todo_id,
            "task_title": titles.get(r.todo_id or ""),
            "queued_at": r.queued_at,
            "started_at": r.started_at,
            "finished_at": r.finished_at,
            "step_count": counts.get(r.id, 0),
            "step_label": (progress.get(r.id) or {}).get("label"),
            "steps_done": (progress.get(r.id) or {}).get("done", 0),
            "steps_total": (progress.get(r.id) or {}).get("total", 0),
            "served": verdicts.get(r.id),
            "promoted": r.id in promoted,
            # A root can spend tokens of its own as well as through its tasks.
            "tokens_in": (r.tokens_in or 0) + tokens.get(r.id, [0, 0])[0],
            "tokens_out": (r.tokens_out or 0) + tokens.get(r.id, [0, 0])[1],
        }
        for r in rows
    ]
    if candidates:
        items = [i for i in items if i["served"] == "yes" and not i["promoted"]]
    return items, len(items)


#: The builtin a load runs (BD7 · LB14). Records are imported **into a model**.
LOAD_PLAN_KEY = "model-import"
BULK_PLAN_KEY = "bulk-load"


_store = ModelStore()


@dataclass(frozen=True, slots=True)
class Opened:
    """What the prologue settled, before any stage ran."""

    model_id: str
    model_name: str
    version_id: str
    version: int
    storage_uri: str

    def as_params(self, *, root: str) -> dict:
        """The root run's ``params`` — what each stage re-resolves itself from."""
        return {
            "root": root,
            "model_id": self.model_id,
            "model": self.model_name,
            "version_id": self.version_id,
            "source": self.storage_uri,
        }


async def open_load(
    session: AsyncSession,
    *,
    graph_id: str,
    name: str,
    path: str | Path,
    model_name: str,
    actor_id: str | None = None,
) -> Opened:
    """Resolve what a load needs before it starts, or refuse it (**LD20**).

    **This is the prologue, and it is not a stage.** It decides whether there is
    anything to run at all, so a refusal here is a load that never started
    rather than one that failed at step one — which is why it sits beside the
    opener that uses it and not in the catalogue.

    Four refusals, all of them *this load never started*: no such model, no
    published version to validate against, no connection, a read-only one.
    Invana never writes to a read-only database, here as everywhere.

    **It registers nothing.** The model is the container, so there is no row to
    create before records can land in it (§ 6.7); what this settles rides on the
    run's own ``params``, which is also where the folder is read back from.
    """
    root = Path(path)

    models = await _store.list_graph_models(session, graph_id=graph_id)
    model = next((m for m in models if m.name.lower() == model_name.lower()), None)
    if model is None:
        known = ", ".join(m.name for m in models) or "none"
        raise LoadRefused(f"No model named {model_name!r} in this Graph. Models here: {known}.")
    version = await _store.get_active_version(session, model.id)
    if version is None:
        raise LoadRefused(
            f"{model.name} has no published version. Author and commit the model before importing against it."
        )

    connection = await GraphManager().get_graph_connection(session, graph_id=graph_id)
    if connection is None:
        raise LoadRefused("Graph has no connection — attach one before importing.")
    if connection.read_only:
        raise LoadRefused("This connection is marked read-only. Invana never writes to a read-only database.")

    return Opened(
        model_id=model.id,
        model_name=model.name,
        version_id=version.id,
        version=version.version,
        storage_uri=f"file://{root.resolve()}",
    )


async def open_load_run(
    db: AsyncSession,
    *,
    graph: Graph,
    name: str,
    path: str,
    model_name: str,
    actor_id: str | None = None,
) -> TaskRun:
    """Open the run a load runs as, against the plan the library holds.

    **This is the whole of what ``import_dataset`` used to do before it ran the
    stages itself.** The prologue settles what the load needs or refuses it
    ([LD20](docs/for-developers/modules/bring-data-in/features/load-data.md));
    the plan says which primitives run and in what order; the interpreter walks
    them. Nothing here knows that a load has four steps — `model-import@1`
    does, and it is rows a person can open.

    The run is left **queued**. Handing it to the runtime is the caller's, which
    is what lets the CLI await it and a route submit it.
    """
    opened = await open_load(db, graph_id=graph.id, name=name, path=path, model_name=model_name, actor_id=actor_id)
    selected = await select_plan_by_key(db, graph_id=graph.id, key=LOAD_PLAN_KEY)
    if selected is None:
        raise RuntimeError(f"The plan library has no populated {LOAD_PLAN_KEY!r}; run a migration before loading.")
    steps = [PlanStep.parse(dict(s), index=i) for i, s in enumerate(selected.steps)]

    run = TaskRun(
        graph_id=graph.id,
        author_id=actor_id,
        author_kind="user" if actor_id else "system",
        ask_kind="import",
        body=f"Import {name}",
        params=opened.as_params(root=str(path)),
        workflow_key=selected.ref,
        task_plan_id=selected.plan_id,
        plan_origin=f"template:{selected.ref}",
        triggered_by=TriggeredBy.user.value if actor_id else TriggeredBy.schedule.value,
        on_behalf_of_user_id=actor_id,
        status=RunStatus.queued.value,
        # A load is governed like any other run ([GV36]): the Graph's guardrails,
        # no agent and no world — nobody picks a world for a load.
        **await freeze_lens(db, graph_id=graph.id, agent_id=None, lens_id=None),
    )
    db.add(run)
    await db.flush()
    # The plan as it ran, frozen on the run — the same document an ask freezes,
    # so a load replays the way an answer does (SR29).
    run.plan_revision = 1
    run.plan_snapshot = plan_payload(steps, source=run.plan_origin or "", version=1)
    await queue_plan_steps(db, run=run, message_id=None, steps=steps, start_seq=0)
    return run


async def open_bulk_run(
    db: AsyncSession,
    *,
    graph: Graph,
    path: str,
    batch_size: int = 500,
    skip_on_error: bool = False,
    keep_source_ids: bool = True,
    actor_id: str | None = None,
) -> TaskRun:
    """Open the run an `invana loader` load runs as (**LD10**).

    **Two kinds of run, one journal.** A bulk load walks a plan like everything
    else — `bulk-load@1`, one step — so it retries, cancels, streams and shows a
    trace exactly as an import does. What differs is the kind, and the kind is
    what says this one validated nothing and carries no provenance.

    There is no prologue: a fast load resolves no model and pins no version,
    because it checks against neither. The Graph's connection is the only thing
    it needs, and `bulk_write` asks for that itself.
    """
    selected = await select_plan_by_key(db, graph_id=graph.id, key=BULK_PLAN_KEY)
    if selected is None:
        raise RuntimeError(f"The plan library has no populated {BULK_PLAN_KEY!r}; run a migration before loading.")
    steps = [PlanStep.parse(dict(s), index=i) for i, s in enumerate(selected.steps)]
    root = Path(path).resolve()

    run = TaskRun(
        graph_id=graph.id,
        author_id=actor_id,
        author_kind="user" if actor_id else "system",
        ask_kind="bulk",
        body=f"Bulk load {root.name}",
        params={
            "root": str(root),
            "source": f"file://{root}",
            "batch_size": batch_size,
            "skip_on_error": skip_on_error,
            "keep_source_ids": keep_source_ids,
        },
        workflow_key=selected.ref,
        task_plan_id=selected.plan_id,
        plan_origin=f"template:{selected.ref}",
        triggered_by=TriggeredBy.user.value if actor_id else TriggeredBy.schedule.value,
        on_behalf_of_user_id=actor_id,
        status=RunStatus.queued.value,
        **await freeze_lens(db, graph_id=graph.id, agent_id=None, lens_id=None),
    )
    db.add(run)
    await db.flush()
    run.plan_revision = 1
    run.plan_snapshot = plan_payload(steps, source=run.plan_origin or "", version=1)
    await queue_plan_steps(db, run=run, message_id=None, steps=steps, start_seq=0)
    return run
