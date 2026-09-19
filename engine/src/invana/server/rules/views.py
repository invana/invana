"""HTTP views for Rules.

Parse, call one manager, serialise (migration-plan §4.1). A Graph's list is its
invariants; a Project's is its working rules, with the Graph's invariants
alongside as ``inherited`` — read-only, so the panel can grey them
([C3](docs/for-developers/modules/skills/features/rules.md)).
"""

from __future__ import annotations

from fastapi import Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.schemas import (
    RuleCitationsResponse,
    RuleCreate,
    RuleListResponse,
    RuleRead,
    RuleUpdate,
    RuleVersionListResponse,
    RuleVersionRead,
)
from invana.apps.work.managers import ProjectManager
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime.managers import RuleCitationManager
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

rules = RuleManager()
projects = ProjectManager()
citations = RuleCitationManager()


async def _with_citations(session: AsyncSession, *, graph_id: str, items: list) -> list[RuleRead]:
    """The rows, each carrying how often it was cited.

    The count is on the row because the drawer draws it there — a list surface
    that has to fetch a number per row is a list surface that fetches N times.
    """
    counts = await citations.counts_for(session, graph_id=graph_id, rules=items)
    reads = []
    for rule in items:
        read = RuleRead.model_validate(rule)
        read.citations = counts.get(rule.id, 0)
        reads.append(read)
    return reads


# ── a Graph's invariants ──────────────────────────────────────────────────────


async def list_invariants(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RuleListResponse:
    """Every invariant on this Graph, active and inactive, in offer order."""
    items = await rules.invariants(session, graph_id=graph.id)
    reads = await _with_citations(session, graph_id=graph.id, items=items)
    return RuleListResponse(items=reads, total=len(reads))


async def create_invariant(
    payload: RuleCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    rule = await rules.create(session, graph_id=graph.id, project_id=None, payload=payload, actor_id=user.id)
    return RuleRead.model_validate(rule)


# ── a Project's working rules ─────────────────────────────────────────────────


async def list_working_rules(
    key: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RuleListResponse:
    """This Project's working rules, and the Graph invariants it inherits.

    The inherited half is returned rather than merged: they are read-only here
    and the panel shows them above, greyed — a project that edits an invariant
    is editing the Graph, which is a different act on a different surface.
    """
    project = await projects.get_by_key(session, key=key, graph_id=graph.id)
    items = await rules.working(session, project_id=project.id)
    inherited = await rules.invariants(session, graph_id=graph.id)
    reads = await _with_citations(session, graph_id=graph.id, items=items)
    return RuleListResponse(
        items=reads,
        total=len(reads),
        inherited=await _with_citations(session, graph_id=graph.id, items=inherited),
    )


async def create_working_rule(
    payload: RuleCreate,
    key: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id)
    rule = await rules.create(session, graph_id=graph.id, project_id=project.id, payload=payload, actor_id=user.id)
    return RuleRead.model_validate(rule)


# ── one rule, wherever it is scoped ───────────────────────────────────────────


async def get_rule(
    rule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    return RuleRead.model_validate(await rules.get(session, rule_id=rule_id, graph_id=graph.id))


async def update_rule(
    payload: RuleUpdate,
    rule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    """Reword it, reorder it, or both. A rewording publishes the next version."""
    rule = await rules.get(session, rule_id=rule_id, graph_id=graph.id)
    return RuleRead.model_validate(await rules.update(session, rule=rule, payload=payload, actor_id=user.id))


async def activate_rule(
    rule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    rule = await rules.get(session, rule_id=rule_id, graph_id=graph.id)
    return RuleRead.model_validate(await rules.set_active(session, rule=rule, active=True, actor_id=user.id))


async def deactivate_rule(
    rule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    """Stop offering it. There is no delete: past citations must still resolve."""
    rule = await rules.get(session, rule_id=rule_id, graph_id=graph.id)
    return RuleRead.model_validate(await rules.set_active(session, rule=rule, active=False, actor_id=user.id))


async def list_rule_versions(
    rule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RuleVersionListResponse:
    """Every published wording, newest first — what a citation resolves to."""
    rule = await rules.get(session, rule_id=rule_id, graph_id=graph.id)
    items = await rules.list_versions(session, rule=rule)
    reads = [RuleVersionRead.model_validate(v) for v in items]
    return RuleVersionListResponse(items=reads, total=len(reads))


async def rule_citations(
    rule_id: str = Path(...),
    limit: int = 25,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RuleCitationsResponse:
    """Where this rule was cited, and which wording each step read.

    A citation is the model's own claim — a rule is offered and cited, never
    enforced. Each row names the version it resolved to, so a rewording or a
    deactivation leaves every past citation reading exactly as it did.
    """
    rule = await rules.get(session, rule_id=rule_id, graph_id=graph.id)
    return await citations.for_rule(session, rule=rule, graph_id=graph.id, limit=limit)
