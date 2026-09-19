"""HTTP views for graph-scoped LLM providers.

Parse, call one manager, serialise (migration-plan §4.1). The encryption key
comes from settings at the edge — the manager takes it as an argument rather
than reaching for global configuration.
"""

from __future__ import annotations

from fastapi import Depends, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.llm_providers.managers import LLMProviderManager
from invana.apps.llm_providers.schemas import (
    LLMPingResponse,
    LLMProviderCreate,
    LLMProviderListResponse,
    LLMProviderRead,
    LLMProviderUpdate,
)
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.settings import settings
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

providers = LLMProviderManager()


async def list_llm_providers(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderListResponse:
    items = await providers.list_for_graph(session, graph_id=graph.id)
    reads = [LLMProviderRead.model_validate(p) for p in items]
    return LLMProviderListResponse(items=reads, total=len(reads))


async def create_llm_provider(
    payload: LLMProviderCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    provider = await providers.create(
        session,
        graph_id=graph.id,
        payload=payload,
        encryption_key=settings.encryption_key,
        actor_id=user.id,
    )
    return LLMProviderRead.model_validate(provider)


async def get_llm_provider(
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    provider = await providers.get(session, provider_id=provider_id, graph_id=graph.id)
    return LLMProviderRead.model_validate(provider)


async def update_llm_provider(
    payload: LLMProviderUpdate,
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    provider = await providers.get(session, provider_id=provider_id, graph_id=graph.id)
    updated = await providers.update(
        session,
        provider=provider,
        payload=payload,
        encryption_key=settings.encryption_key,
        actor_id=user.id,
    )
    return LLMProviderRead.model_validate(updated)


async def delete_llm_provider(
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    provider = await providers.get(session, provider_id=provider_id, graph_id=graph.id)
    await providers.delete(session, provider=provider, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def ping_llm_provider(
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LLMPingResponse:
    provider = await providers.get(session, provider_id=provider_id, graph_id=graph.id)
    result = await providers.ping(
        session,
        provider=provider,
        encryption_key=settings.encryption_key,
        actor_id=user.id,
    )
    return LLMPingResponse(**result)


async def set_default_llm_provider(
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    provider = await providers.get(session, provider_id=provider_id, graph_id=graph.id)
    updated = await providers.set_default(session, provider=provider, actor_id=user.id)
    return LLMProviderRead.model_validate(updated)
