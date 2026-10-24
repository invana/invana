"""HTTP views for the agents list.

Parse, call one manager, serialise (migration-plan §4.1). Retirement, deletion
and lineage go through ``runtime.managers.AgentLifecycleManager`` — they read
`runs`, which an app may not.
"""

from __future__ import annotations

from fastapi import Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import AgentActsManager, FleetManager
from invana.activity.schemas import FleetOverview, FleetPerformance
from invana.apps.agents.managers import AgentManager, SoulManager
from invana.apps.agents.models import AgentStatus
from invana.apps.agents.schemas import (
    AGENT_LIST,
    AgentCreate,
    AgentDraftWrite,
    AgentLineageResponse,
    AgentMakeLive,
    AgentMeters,
    AgentOverview,
    AgentPage,
    AgentPublish,
    AgentRead,
    AgentRollback,
    AgentSkillsAndCallables,
    AgentUpdate,
    DefaultAgentRequest,
    LifecycleAct,
    LifecyclePreview,
    RetireRequest,
    SoulPreviewRequest,
    SoulPreviewResponse,
)
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.skills.managers import SkillBindingManager, SkillManager
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.events.schemas import EventListResponse
from invana.core.events.store import EventFilter, EventStore
from invana.core.lists import ListParams, applied_filters, list_params
from invana.runtime.managers import (
    AgentCapabilitiesManager,
    AgentLifecycleManager,
    AgentOverviewManager,
    EvalManager,
    SkillBindManager,
)
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

agents = AgentManager()
lifecycle = AgentLifecycleManager()
acts = AgentActsManager()
capabilities = AgentCapabilitiesManager()
overviews = AgentOverviewManager()
souls = SoulManager()
skills = SkillManager()
bindings = SkillBindingManager()
#: The bind-time checks. Skills and plans are two apps, so the check that reads
#: both is composed one band up (`runtime/managers/skill_bind.py`) and handed to
#: the binding manager.
binds = SkillBindManager()
evals = EvalManager()
fleet = FleetManager()

#: `?window=` → days; Performance offers these three and no other.
_WINDOWS = {"7d": 7, "30d": 30, "90d": 90}


async def list_agents(
    params: ListParams = Depends(list_params(AGENT_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentPage:
    # The read seeds on first touch, so it commits.
    rows, info = await agents.page_agents(session, graph=graph, params=params)
    reads = await agents.reads(session, list(rows))
    persistent, ephemeral = await agents.count_by_lifetime(session, graph_id=graph.id)
    return AgentPage(
        items=reads,
        total=info.total,
        unfiltered_total=info.unfiltered_total,
        next_cursor=info.next_cursor,
        applied=applied_filters(params, AGENT_LIST),
        persistent=persistent,
        ephemeral=ephemeral,
        default_agent_id=graph.default_agent_id,
        # One grouped read for the whole list, not one per row: the meter is
        # on every row, and a query per agent would be the shape the composite
        # index was built to avoid.
        tokens_this_month=await lifecycle.tokens_this_month(session, graph_id=graph.id),
    )


async def create_agent(
    payload: AgentCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    """Write a new agent as a **draft**: built, never offered work until *Create agent*."""
    agent = await agents.create_agent(session, graph=graph, payload=payload, actor=user, bind_check=binds.check)
    return await agents.read(session, agent)


async def make_agent_live(
    payload: AgentMakeLive | None = None,
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    """*Create agent* — move a draft to active through its eval gate.

    Refused with 409 unless the agent is a draft, and by the gate:
    ``eval_required`` · ``eval_running`` · ``eval_failed`` · ``eval_warned``
    (a warning passes with a ``why``). With no eval set it passes unchecked.
    """
    payload = payload or AgentMakeLive()
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    evaluated = (
        await evals.gate(
            session,
            graph_id=graph.id,
            subject_kind="agent",
            subject_id=agent.id,
            unchanged_pin=False,
            model_pin=agent.model_pin,
            why=payload.why,
        )
        if agent.status == AgentStatus.draft.value
        else None
    )
    agent = await agents.make_live(session, agent=agent, actor=user, why=payload.why, evaluated=evaluated)
    return await agents.read(session, agent)


async def agent_overview(
    agent_id: str = Path(...),
    window: str = Query(default="30d", pattern="^(7d|30d|90d)$"),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentOverview:
    """A live agent's Overview: its root runs over the window against the one
    before, a row per day, how runs ended, the newest runs and the model
    versions it ran on — every number stored or counted here, never by the reader."""
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await overviews.overview(session, agent=agent, days=_WINDOWS[window])


async def get_agent(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await agents.read(session, agent)


async def update_agent(
    payload: AgentUpdate,
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    """Edit an agent. Moving its pin passes the eval gate first, on the new pin."""
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    moving = "model_pin" in payload.model_fields_set and payload.model_pin != agent.model_pin
    evaluated = None
    if moving:
        evaluated = await evals.gate(
            session,
            graph_id=graph.id,
            subject_kind="agent",
            subject_id=agent.id,
            model_pin=payload.model_pin,
            unchanged_pin=False,
            why=payload.why,
        )
    agent = await agents.update_agent(session, agent=agent, payload=payload, actor=user, evaluated=evaluated)
    return await agents.read(session, agent)


async def write_agent_draft(
    payload: AgentDraftWrite,
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    """Write the agent's unpublished instructions. Runs keep reading the published ones."""
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    agent = await agents.write_draft(session, agent=agent, instructions=payload.instructions)
    return await agents.read(session, agent)


async def discard_agent_draft(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    agent = await agents.discard_draft(session, agent=agent)
    return await agents.read(session, agent)


async def publish_agent_instructions(
    payload: AgentPublish,
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    """Publish the draft into the agent's instructions — the next agent version.

    Refused with 409 when no draft is open, and by the eval gate.
    """
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    evaluated = (
        await evals.gate(session, graph_id=graph.id, subject_kind="agent", subject_id=agent.id, why=payload.why)
        if agent.instructions_draft is not None
        else None
    )
    agent = await agents.publish_instructions(session, agent=agent, actor=user, why=payload.why, evaluated=evaluated)
    return await agents.read(session, agent)


async def rollback_agent_instructions(
    payload: AgentRollback,
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    """Restore the instructions as they were at an earlier version, as the next version.

    Refused with 409 while a draft is open, when that text is already current,
    or when it predates recorded edits; 404 for a version the agent never had.
    The eval gate reads the restored text against today's set.
    """
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    evaluated = (
        await evals.gate(
            session,
            graph_id=graph.id,
            subject_kind="agent",
            subject_id=agent.id,
            version=payload.version,
            why=payload.why,
        )
        if agent.instructions_draft is None and payload.version < agent.version
        else None
    )
    agent = await agents.rollback_instructions(
        session, agent=agent, version=payload.version, actor=user, why=payload.why, evaluated=evaluated
    )
    return await agents.read(session, agent)


async def delete_agent(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    await lifecycle.delete_agent(session, agent=agent, actor=user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def pause_agent(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    agent = await agents.set_status(session, agent=agent, status=AgentStatus.paused, actor=user)
    return await agents.read(session, agent)


async def resume_agent(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    agent = await agents.set_status(session, agent=agent, status=AgentStatus.active, actor=user)
    return await agents.read(session, agent)


async def preview_pause(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LifecyclePreview:
    """What pausing would do. Pausing blocks the same todos retiring blocks, so
    it names them the same way before it happens, and names each schedule
    that starts the agent."""
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await acts.preview(session, agent=agent, act=LifecycleAct.pause)


async def preview_retire(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LifecyclePreview:
    """What retiring would do. The confirm dialog **names the open work item by
    item** — a count is not enough to decide with — and each schedule that
    starts the agent, which retiring pauses."""
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await acts.preview(session, agent=agent, act=LifecycleAct.retire)


async def retire_agent(
    payload: RetireRequest | None = None,
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    payload = payload or RetireRequest()
    agent = await acts.retire(
        session,
        agent=agent,
        actor=user,
        reassign_to_kind=payload.reassign_to_kind,
        reassign_to_id=payload.reassign_to_id,
        why=payload.why,
    )
    return await agents.read(session, agent)


async def agent_lineage(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentLineageResponse:
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await lifecycle.lineage(session, agent=agent)


async def agent_activity(
    agent_id: str = Path(...),
    cursor: str | None = Query(default=None),
    page_size: int = Query(default=50, ge=1, le=200),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> EventListResponse:
    """Everything this agent did, newest first — the flat feed filtered to one
    actor, which is the same rows the Events rail shows."""
    await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await EventStore().list_page(
        session,
        filters=EventFilter(graph_id=graph.id, actor_id=agent_id, actor_kind="agent"),
        cursor=cursor,
        page_size=page_size,
    )


async def agent_meters(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentMeters:
    """What the agent is using now, beside the limits that cap it."""
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await lifecycle.meters(session, agent=agent)


async def skills_and_callables(
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AgentSkillsAndCallables:
    """Both tables of *What this agent can do*, each naming the other."""
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await capabilities.read(session, agent=agent)


async def preview_soul(
    payload: SoulPreviewRequest,
    agent_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SoulPreviewResponse:
    """One ask, in the current voice and in the draft. Saves nothing."""
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    return await souls.preview(session, agent=agent, payload=payload)


async def set_default_agent(
    payload: DefaultAgentRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    agent = await agents.get_or_404(session, agent_id=payload.agent_id, graph_id=graph.id)
    await agents.set_default_agent(session, graph=graph, agent=agent, actor=user)
    return await agents.read(session, agent)


async def bind_skill(
    agent_id: str = Path(...),
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    """Offer a skill to this agent.

    A skill reaches a step only through a binding, and a binding names one
    skill and one agent — which is what gives a refusal something to name.
    Binding what is already bound is a 409: the caller believes it is changing
    the bindings, and it is not.

    A skill this agent could **never** run is refused here rather than inside a
    run: if the plan its current version draws names a `step_key` the agent's
    envelope does not allow, the 409 body names the step, its bound, and which checks ran —
    `checked` and `not_checked`, because a bind is never refused on grounds it
    did not check.
    """
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    await bindings.bind(
        session,
        skill=skill,
        agent_id=agent.id,
        agent_name=agent.name,
        actor_id=user.id,
        check=binds.check,
    )
    await session.refresh(agent, ["bound_skills"])
    return await agents.read(session, agent)


async def unbind_skill(
    agent_id: str = Path(...),
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AgentRead:
    """Stop offering a skill to this agent.

    The next run is not offered it; a run already in flight has its prompt and
    is unaffected.
    """
    agent = await agents.get_or_404(session, agent_id=agent_id, graph_id=graph.id)
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    await bindings.unbind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)
    await session.refresh(agent, ["bound_skills"])
    return await agents.read(session, agent)


async def fleet_overview(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> FleetOverview:
    """The Agents Overview — what broke, waits, slowed or changed (fleet-performance.md)."""
    return await fleet.overview(session, graph_id=graph.id)


async def fleet_performance(
    window: str = Query(default="7d", pattern="^(7d|30d|90d)$"),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> FleetPerformance:
    """The Agents Performance page — speed, success and tokens per agent, skill, plan and model."""
    return await fleet.performance(session, graph_id=graph.id, window=_WINDOWS[window])
