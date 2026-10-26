"""HTTP views for Rules.

Parse, call one manager, serialise (migration-plan §4.1). A Graph's list is its
invariants, with the install's rules alongside as ``inherited``; a Project's is
its working rules, with the install's rules and the Graph's invariants as
``inherited`` — read-only, in assembly order, so the panel can grey them
(docs/for-developers/modules/skills/features/rules.md, C3).

The install's own rules have no Graph and no citations read here: their
routes read and write the rule, and writing is an install Admin's.
"""

from __future__ import annotations

from fastapi import Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.schemas import (
    RULE_LIST,
    RuleCitationsResponse,
    RuleCreate,
    RuleImpact,
    RuleImpactRequest,
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
from invana.core.lists import ListParams, Page, applied_filters, list_params
from invana.runtime.managers import RuleCitationManager, RuleImpactManager, RulePageManager
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

rules = RuleManager()
projects = ProjectManager()
citations = RuleCitationManager()
impact = RuleImpactManager()
pages = RulePageManager()


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


async def list_rules(
    params: ListParams = Depends(list_params(RULE_LIST)),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Page[RuleRead]:
    """Every rule in force here — the install's, the Graph's, each visible project's — in assembly order."""
    items, info = await pages.in_force(session, graph=graph, reader_id=member.user_id, params=params)
    return Page[RuleRead].of(items, info, applied_filters(params, RULE_LIST))


async def rule_impact(
    payload: RuleImpactRequest,
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RuleImpact:
    """What this check would have broken in the last 30 days, read in this Graph."""
    project_id = None
    if payload.scope == "project":
        key = payload.project_key or ""
        project_id = (await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)).id
    return await impact.of_check(
        session,
        check=payload.check.model_dump(exclude_none=True),
        scope=payload.scope,
        graph_id=graph.id,
        project_id=project_id,
    )


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
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> RuleListResponse:
    """This Project's working rules, and the install rules and Graph invariants it inherits.

    The inherited half is returned rather than merged: they are read-only here
    and the panel shows them above, greyed — a project that edits an invariant
    is editing the Graph, which is a different act on a different surface.
    """
    project = await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)
    items = await rules.working(session, project_id=project.id)
    inherited = [*await rules.install(session), *await rules.invariants(session, graph_id=graph.id)]
    reads = await _with_citations(session, graph_id=graph.id, items=items)
    return RuleListResponse(
        items=reads,
        total=len(reads),
        inherited=await _with_citations(session, graph_id=graph.id, items=inherited),
    )


async def create_working_rule(
    payload: RuleCreate,
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)
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


# ── the install's rules ───────────────────────────────────────────────────────


async def list_install_rules(
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleListResponse:
    """Every install rule, active and inactive, in offer order."""
    reads = [RuleRead.model_validate(r) for r in await rules.install(session)]
    return RuleListResponse(items=reads, total=len(reads))


async def create_install_rule(
    payload: RuleCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    """An install rule — offered in every Graph, and checked where its check says."""
    return RuleRead.model_validate(await rules.create_install(session, payload=payload, actor=user))


async def install_rule_impact(
    payload: RuleImpactRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleImpact:
    """What an install check would have broken in the last 30 days, in every Graph."""
    rules.require_install_admin(user)
    return await impact.of_check(
        session, check=payload.check.model_dump(exclude_none=True), scope="install", graph_id=None
    )


async def get_install_rule(
    rule_id: str = Path(...),
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    return RuleRead.model_validate(await rules.get_install(session, rule_id=rule_id))


async def update_install_rule(
    payload: RuleUpdate,
    rule_id: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    """Reword, re-check or reorder it. A new statement, check or mode publishes the next version."""
    return RuleRead.model_validate(await rules.update_install(session, rule_id=rule_id, payload=payload, actor=user))


async def activate_install_rule(
    rule_id: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    return RuleRead.model_validate(await rules.set_install_active(session, rule_id=rule_id, active=True, actor=user))


async def deactivate_install_rule(
    rule_id: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleRead:
    """Stop offering and checking it. Its versions and past checks stay."""
    return RuleRead.model_validate(await rules.set_install_active(session, rule_id=rule_id, active=False, actor=user))


async def list_install_rule_versions(
    rule_id: str = Path(...),
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RuleVersionListResponse:
    rule = await rules.get_install(session, rule_id=rule_id)
    reads = [RuleVersionRead.model_validate(v) for v in await rules.list_versions(session, rule=rule)]
    return RuleVersionListResponse(items=reads, total=len(reads))
