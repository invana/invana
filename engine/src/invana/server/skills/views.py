"""HTTP views for Skills.

Each one parses the request, calls **one** manager method, and serialises the
result. No rule, no query, no commit, no event (migration-plan §4.1) — so every
handler here is a couple of lines, and the part worth testing lives in
``apps/skills/managers``.

Status codes come from ``core.errors`` through the handlers in
``server/app.py``: ``NotFoundError`` → 404, ``ConflictError`` → 409.

There is no ``server/skills/deps.py``: Skills has no dependency of its own. It
reuses the shared ones under their existing names.
"""

from __future__ import annotations

from fastapi import Depends, Path, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.schemas import SkillUsageResponse
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import (
    InlinablePlanListResponse,
    SkillAgentsResponse,
    SkillAgentStanding,
    SkillClarificationAnswer,
    SkillCreate,
    SkillDraftRead,
    SkillDraftTasksWrite,
    SkillDrawStarted,
    SkillListResponse,
    SkillPlanRead,
    SkillRead,
    SkillUpdate,
    SkillVersionDiff,
    SkillVersionListResponse,
    SkillVersionPublish,
    SkillVersionRead,
)
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime import services as run_services
from invana.runtime.managers import SkillBindManager, SkillDraftManager, SkillUsageManager
from invana.runtime.planning import resolve_plan
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

skills = SkillManager()
usage = SkillUsageManager()
#: Skills and plans are two apps, and the composition lives one band up
#: (`runtime/managers/skill_draft.py`). A view still calls one manager.
drafts = SkillDraftManager()
#: Both halves of the bind check, and the dry run the Bindings tab reads (BN10).
binds = SkillBindManager()


async def list_skills(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillListResponse:
    reads = await drafts.list_reads(session, graph_id=graph.id)
    return SkillListResponse(items=reads, total=len(reads))


async def create_skill(
    payload: SkillCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SkillRead:
    """Create a skill. It starts as a **draft** with a one-node plan.

    Nothing is offered a draft: a skill reaches a step through its current
    version, and there is not one until someone publishes
    ([SK21 · SK22](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    """
    skill = await drafts.create(session, graph_id=graph.id, payload=payload, actor_id=user.id)
    return await drafts.read_for(session, skill=skill)


async def get_skill(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillRead:
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return await drafts.read_for(session, skill=skill)


async def update_skill(
    payload: SkillUpdate,
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SkillRead:
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    updated = await drafts.update(session, skill=skill, payload=payload, actor_id=user.id)
    return await drafts.read_for(session, skill=updated)


async def delete_skill(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    await skills.delete(session, skill=skill, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def list_skill_versions(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillVersionListResponse:
    """Every published version, newest first.

    A published version is immutable, so this is a history rather than a list of
    drafts — the one at the top is what the next run is offered.
    """
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    items = await skills.list_versions(session, skill=skill)
    reads = [SkillVersionRead.model_validate(v) for v in items]
    return SkillVersionListResponse(items=reads, total=len(reads))


async def publish_skill_version(
    payload: SkillVersionPublish,
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SkillVersionRead:
    """Publish the next version. Fields left out carry over from the current one."""
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    version = await drafts.publish(session, skill=skill, payload=payload, actor_id=user.id)
    return SkillVersionRead.model_validate(version)


async def get_skill_draft(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillDraftRead:
    """The version being written — its text, its plan, and any open question.

    Opening a draft over a published version **copies that version's plan**, so
    a redraw is a revision and the diff reads against what was drawn
    ([SK12](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    """
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return await drafts.draft_read(session, skill=skill)


async def update_skill_draft(
    payload: SkillVersionPublish,
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillDraftRead:
    """Edit the draft's prose. A published version is never touched (SK2)."""
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return await drafts.write_draft(session, skill=skill, payload=payload)


async def discard_skill_draft(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Throw the draft away. Its plan goes with it — nothing ever resolved to it."""
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    await drafts.discard_draft(session, skill=skill)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def write_skill_draft_tasks(
    payload: SkillDraftTasksWrite,
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillDraftRead:
    """Hand-edit the draft's plan, and take ownership of it.

    The rows are replaced wholesale, and `task_plans.origin` flips to
    `authored` — after which redrawing from the prose is **offered, never
    automatic**, and says what it would discard
    ([SK7](docs/for-developers/modules/skills/features/authoring-a-skill.md)).

    What is checked is the **catalogue**, not an agent's envelope: a skill
    belongs to no agent, so *may this agent call this step* is checked where
    the agent is known — at bind time
    ([SK28](docs/for-developers/modules/skills/features/authoring-a-skill.md) ·
    [BN5](docs/for-developers/modules/skills/features/bindings.md)).
    """
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return await drafts.write_tasks(session, skill=skill, tasks=payload.tasks, validate=resolve_plan)


async def draw_skill_draft(
    request: Request,
    skill_id: str = Path(...),
    username: str = Path(...),
    graphSlug: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SkillDrawStarted:
    """Draw the draft's playbook as a plan.

    It is an ordinary run with `role = plan`
    ([SK23](docs/for-developers/modules/skills/features/authoring-a-skill.md)):
    stream it like any other, and read what it did in Runs. If a sentence
    carries two readings the run **settles** having written nothing and
    recorded the question against that sentence — the card in the editor is
    where it is answered.
    """
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    run = await drafts.start_draw(session, graph=graph, skill=skill, actor_id=user.id)
    await session.commit()
    request.app.state.task_runtime.submit(run.id)
    return SkillDrawStarted(run_id=run.id, stream_url=run_services.stream_url(username, graphSlug, run.id))


async def answer_clarification(
    payload: SkillClarificationAnswer,
    skill_id: str = Path(...),
    clarification_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SkillDraftRead:
    """Answer the question the planner stopped on.

    The answer is recorded on the version, so a redraw never re-asks
    ([SK11](docs/for-developers/modules/skills/features/authoring-a-skill.md)).

    It opens **no** run. The draw that asked has already settled
    ([SK26](docs/for-developers/modules/skills/features/authoring-a-skill.md)) —
    there is nothing to resume — so this records and returns the draft, and the
    surface opens the next draw with what comes back
    ([SK30](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    """
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return await drafts.answer(
        session, skill=skill, clarification_id=clarification_id, answer=payload.answer, actor_id=user.id
    )


async def skill_version_plan(
    skill_id: str = Path(...),
    version: int = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillPlanRead:
    """One version's plan, as nodes and edges.

    Each node carries the **band** it sits in and the sentence it was drawn
    from, so the Flow tab draws the six layers and the Playbook tab can show
    each sentence beside the step it produced
    ([SK16 · C11](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    """
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    row = await skills.get_version(session, skill=skill, version=version)
    return await drafts.plan_read(session, version=row)


async def get_skill_version(
    skill_id: str = Path(...),
    version: int = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillVersionRead:
    """One version by its number — what a step that named it was actually offered."""
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return SkillVersionRead.model_validate(await skills.get_version(session, skill=skill, version=version))


async def diff_skill_version(
    skill_id: str = Path(...),
    version: int = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillVersionDiff:
    """What this version changed against the one before it.

    Unified diff lines per field. `v1` diffs against nothing rather than against
    empty text — a first version did not delete anything.
    """
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return await skills.diff_version(session, skill=skill, version=version)


async def inlinable_plans(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> InlinablePlanListResponse:
    """The library plans a skill may inline, each with what it offers a caller.

    One read for the picker **and** the tuning, because they are one act: a
    person who inlines `nl-single@1` decides its `read_only` in the same breath
    ([LB19](docs/for-developers/modules/workflows/features/the-library.md)).
    """
    return InlinablePlanListResponse(items=await drafts.inlinable(session, graph_id=graph.id))


async def skill_agents(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillAgentsResponse:
    """Where this skill stands with every agent — bound, refused, not bound.

    The refusals are the bind checks run as a **dry run**, not a prediction the
    surface makes ([BN10](docs/for-developers/modules/skills/features/bindings.md)):
    the agents a skill cannot be offered are worth seeing before a click, and
    the only reading of the rules that cannot go stale is the one that refuses.
    """
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    standings = await binds.standings(session, skill=skill)
    return SkillAgentsResponse(items=[SkillAgentStanding(**row) for row in standings])


async def skill_usage(
    skill_id: str = Path(...),
    limit: int = 25,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillUsageResponse:
    """Where this skill is carried, and where it was offered or reported.

    Two levels, labelled honestly (docs/for-developers/modules/work/spec.md): *offered* is a fact written
    by prompt assembly; *reported* is the model saying it followed the prose.
    ``reported`` on a row is the difference, and the badge says so.
    """
    # A view's docstring is published as the endpoint `description` in the
    # OpenAPI schema, so it is part of the API contract — it stays here even
    # when the logic it describes moves to a manager.
    skill = await skills.get(session, skill_id=skill_id, graph_id=graph.id)
    return await usage.for_skill(session, skill=skill, graph_id=graph.id, limit=limit)
