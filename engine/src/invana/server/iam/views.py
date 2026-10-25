"""HTTP views for IAM — policies, who holds them, people, service accounts and groups.

docs/for-developers/modules/identity-and-access/features/policies.md ·
features/people-and-groups.md. Parse, call one manager, serialise. Reads are
open to every member; every write is the ``iam`` area, so the guard
(``require_graph_member``) refuses it without iam-admin and names who holds it.
"""

from __future__ import annotations

from fastapi import Depends, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.iam.managers.attachments import AttachmentManager
from invana.apps.iam.managers.drafting import PolicyDraftManager
from invana.apps.iam.managers.groups import GroupManager
from invana.apps.iam.managers.people import PeopleManager
from invana.apps.iam.managers.policies import PolicyManager
from invana.apps.iam.managers.service_accounts import ServiceAccountManager
from invana.apps.iam.schemas import (
    GROUP_LIST,
    HOLDER_LIST,
    PEOPLE_LIST,
    POLICY_LIST,
    AttachRequest,
    GroupCreate,
    GroupMemberAdd,
    GroupRead,
    GroupRow,
    GroupUpdate,
    HolderPage,
    HolderRow,
    PeoplePage,
    PersonRow,
    PolicyCreate,
    PolicyDraftRequest,
    PolicyPage,
    PolicyRead,
    PolicySave,
    PolicyUpdate,
    PolicyVersionRead,
    ServiceAccountCreate,
)
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.lists import ListParams, Page, applied_filters, list_params
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

_policies = PolicyManager()
_attachments = AttachmentManager()
_drafts = PolicyDraftManager()
_people = PeopleManager()
_service_accounts = ServiceAccountManager()
_groups = GroupManager()

_NAME = Path(..., description="The policy's name.")
_GROUP = Path(..., description="The group's name.")


# ── policies ─────────────────────────────────────────────────────────────────


async def list_policies(
    params: ListParams = Depends(list_params(POLICY_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> PolicyPage:
    items, info, kinds = await _policies.page(session, graph_id=graph.id, params=params)
    page = PolicyPage.of(items, info, applied_filters(params, POLICY_LIST))
    page.kinds = kinds
    return page


async def create_policy(
    payload: PolicyCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PolicyRead:
    policy = await _policies.create(session, graph_id=graph.id, payload=payload, actor_id=user.id)
    return await _policies.read(session, graph_id=graph.id, policy=policy, actor_id=user.id)


async def draft_policy(
    payload: PolicyDraftRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PolicyRead:
    policy = await _drafts.draft(session, graph_id=graph.id, prompt=payload.prompt, actor_id=user.id)
    return await _policies.read(session, graph_id=graph.id, policy=policy, actor_id=user.id)


async def get_policy(
    name: str = _NAME,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PolicyRead:
    return await _policies.get(session, graph_id=graph.id, name=name, actor_id=user.id)


async def update_policy(
    payload: PolicyUpdate,
    name: str = _NAME,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PolicyRead:
    policy = await _policies.update(session, graph_id=graph.id, name=name, payload=payload, actor_id=user.id)
    return await _policies.read(session, graph_id=graph.id, policy=policy, actor_id=user.id)


async def save_policy(
    payload: PolicySave,
    name: str = _NAME,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PolicyRead:
    policy = await _policies.save(session, graph_id=graph.id, name=name, why=payload.why, actor_id=user.id)
    return await _policies.read(session, graph_id=graph.id, policy=policy, actor_id=user.id)


async def delete_policy(
    name: str = _NAME,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _policies.delete(session, graph_id=graph.id, name=name, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def list_versions(
    name: str = _NAME,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[PolicyVersionRead]:
    return await _policies.versions(session, graph_id=graph.id, name=name)


# ── holders ──────────────────────────────────────────────────────────────────


async def list_holders(
    name: str = _NAME,
    params: ListParams = Depends(list_params(HOLDER_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> HolderPage:
    policy = await _policies.get_row(session, graph_id=graph.id, name=name)
    items, info, kinds = await _attachments.holders(session, graph_id=graph.id, policy=policy, params=params)
    page = HolderPage.of(items, info, applied_filters(params, HOLDER_LIST))
    page.kinds = kinds
    return page


async def attach_holder(
    payload: AttachRequest,
    name: str = _NAME,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> HolderRow:
    policy = await _policies.get_row(session, graph_id=graph.id, name=name)
    return await _attachments.attach(session, graph_id=graph.id, policy=policy, request=payload, actor_id=user.id)


async def detach_holder(
    name: str = _NAME,
    attachment_id: str = Path(..., description="The attachment's id."),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    policy = await _policies.get_row(session, graph_id=graph.id, name=name)
    await _attachments.detach(session, graph_id=graph.id, policy=policy, attachment_id=attachment_id, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── people and service accounts ──────────────────────────────────────────────


async def list_people(
    params: ListParams = Depends(list_params(PEOPLE_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> PeoplePage:
    items, info, kinds = await _people.page(session, graph_id=graph.id, params=params)
    page = PeoplePage.of(items, info, applied_filters(params, PEOPLE_LIST))
    page.kinds = kinds
    return page


async def create_service_account(
    payload: ServiceAccountCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PersonRow:
    return await _service_accounts.create(session, graph_id=graph.id, payload=payload, actor_id=user.id)


# ── groups ───────────────────────────────────────────────────────────────────


async def list_groups(
    params: ListParams = Depends(list_params(GROUP_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Page[GroupRow]:
    items, info = await _groups.page(session, graph_id=graph.id, params=params)
    return Page[GroupRow].of(items, info, applied_filters(params, GROUP_LIST))


async def create_group(
    payload: GroupCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GroupRead:
    return await _groups.create(session, graph_id=graph.id, payload=payload, actor_id=user.id)


async def get_group(
    name: str = _GROUP,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> GroupRead:
    return await _groups.get(session, graph_id=graph.id, name=name)


async def update_group(
    payload: GroupUpdate,
    name: str = _GROUP,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GroupRead:
    return await _groups.update(session, graph_id=graph.id, name=name, payload=payload, actor_id=user.id)


async def delete_group(
    name: str = _GROUP,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _groups.delete(session, graph_id=graph.id, name=name, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def add_group_member(
    payload: GroupMemberAdd,
    name: str = _GROUP,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GroupRead:
    return await _groups.add_member(session, graph_id=graph.id, name=name, payload=payload, actor_id=user.id)


async def remove_group_member(
    name: str = _GROUP,
    member_id: str = Path(..., description="The group membership's id."),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GroupRead:
    return await _groups.remove_member(session, graph_id=graph.id, name=name, member_id=member_id, actor_id=user.id)
