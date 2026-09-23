"""HTTP views for graph-scoped LLM providers.

Parse, call one manager, serialise (migration-plan §4.1). The encryption key
comes from settings at the edge — the manager takes it as an argument rather
than reaching for global configuration.
"""

from __future__ import annotations

from fastapi import Depends, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.managers import LLMEndpointManager
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.llm_providers.managers import LLMProviderManager
from invana.apps.llm_providers.schemas import (
    LLMModelCreate,
    LLMModelListResponse,
    LLMModelRead,
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
# Adding a model, removing one, and renaming the endpoint they hang off are all
# Govern questions — the ranks a model is offered with are what the cast reads
# (PM17), and the refusals on removal and on rename name the worlds that name
# the address (PM11 · PM18). The manager that can read both answers all three.
endpoints = LLMEndpointManager()


async def list_llm_providers(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderListResponse:
    items = await providers.list_for_graph(session, graph_id=graph.id)
    reads = [LLMProviderRead.of(p, await providers.list_models(session, provider=p)) for p in items]
    return LLMProviderListResponse(items=reads, total=len(reads))


async def create_llm_provider(
    payload: LLMProviderCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    # Through Govern, for the same reason `add_llm_model` is: the models an
    # endpoint opens with are ranked the way a later one is (PM17).
    provider = await endpoints.create_provider(
        session,
        graph_id=graph.id,
        payload=payload,
        encryption_key=settings.encryption_key,
        actor_id=user.id,
    )
    return LLMProviderRead.of(provider, await providers.list_models(session, provider=provider))


async def get_llm_provider(
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    provider = await providers.get(session, provider_id=provider_id, graph_id=graph.id)
    return LLMProviderRead.of(provider, await providers.list_models(session, provider=provider))


async def update_llm_provider(
    payload: LLMProviderUpdate,
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    provider = await providers.get(session, provider_id=provider_id, graph_id=graph.id)
    # Through Govern: the `name` is the address segment, so a rename moves
    # `llm/<name>/*` and is refused while a world names it (PM18).
    updated = await endpoints.update_provider(
        session,
        provider=provider,
        payload=payload,
        encryption_key=settings.encryption_key,
        actor_id=user.id,
    )
    return LLMProviderRead.of(updated, await providers.list_models(session, provider=updated))


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


async def list_llm_models(
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMModelListResponse:
    provider = await providers.get(session, provider_id=provider_id, graph_id=graph.id)
    items = await providers.list_models(session, provider=provider)
    reads = [LLMModelRead.of(provider, m) for m in items]
    return LLMModelListResponse(items=reads, total=len(reads))


async def add_llm_model(
    payload: LLMModelCreate,
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LLMModelRead:
    provider = await providers.get(session, provider_id=provider_id, graph_id=graph.id)
    # Through Govern: the ranks a model is offered with are read by `shipped_cast`
    # and by nothing else, so deriving them is the cast's rule (PM17).
    model = await endpoints.add_model(session, provider=provider, payload=payload, actor_id=user.id)
    return LLMModelRead.of(provider, model)


async def remove_llm_model(
    provider_id: str = Path(...),
    model_row_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    provider = await providers.get(session, provider_id=provider_id, graph_id=graph.id)
    model = await providers.get_model(session, provider=provider, model_row_id=model_row_id)
    await endpoints.remove_model(session, provider=provider, model=model, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
