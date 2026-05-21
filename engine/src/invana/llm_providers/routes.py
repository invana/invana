"""HTTP routes for graph-scoped LLM providers.

Endpoints (all under ``/api/v1/u/{username}/{graphSlug}/llm``)
-------------------------------------------------------------
GET    /                  list
POST   /                  create
GET    /{id}              detail
PATCH  /{id}              update (re-encrypts api_key only if supplied)
DELETE /{id}              hard delete
POST   /{id}/ping         credential test
POST   /{id}/set-default  flip is_default, unset others (single transaction)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.db import get_session
from invana.graphs.deps import (
    require_graph_admin,
    require_graph_member,
    resolve_graph_by_username_slug,
)
from invana.graphs.models import Graph, GraphMember
from invana.llm_providers import services
from invana.llm_providers.schemas import (
    LLMPingResponse,
    LLMProviderCreate,
    LLMProviderListResponse,
    LLMProviderRead,
    LLMProviderUpdate,
)
from invana.settings import settings

llm_providers_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/llm",
    tags=["llm-providers"],
)


def _to_read(provider) -> LLMProviderRead:
    return LLMProviderRead(
        id=provider.id,
        graph_id=provider.graph_id,
        provider=provider.provider,
        model_id=provider.model_id,
        has_api_key=provider.api_key_encrypted is not None,
        base_url=provider.base_url,
        guardrails=provider.guardrails,
        is_default=provider.is_default,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


@llm_providers_router.get("", response_model=LLMProviderListResponse)
async def list_llm_providers(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderListResponse:
    items = await services.list_providers(session, graph_id=graph.id)
    reads = [_to_read(p) for p in items]
    return LLMProviderListResponse(items=reads, total=len(reads))


@llm_providers_router.post("", response_model=LLMProviderRead, status_code=status.HTTP_201_CREATED)
async def create_llm_provider(
    payload: LLMProviderCreate,
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    provider = await services.create_provider(
        session,
        graph_id=graph.id,
        payload=payload,
        encryption_key=settings.encryption_key,
    )
    await session.commit()
    await session.refresh(provider)
    return _to_read(provider)


@llm_providers_router.get("/{provider_id}", response_model=LLMProviderRead)
async def get_llm_provider(
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    provider = await services.get_or_404(session, provider_id=provider_id, graph_id=graph.id)
    return _to_read(provider)


@llm_providers_router.patch("/{provider_id}", response_model=LLMProviderRead)
async def update_llm_provider(
    payload: LLMProviderUpdate,
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    provider = await services.get_or_404(session, provider_id=provider_id, graph_id=graph.id)
    updated = await services.update_provider(
        session,
        provider=provider,
        payload=payload,
        encryption_key=settings.encryption_key,
    )
    await session.commit()
    await session.refresh(updated)
    return _to_read(updated)


@llm_providers_router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_llm_provider(
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    provider = await services.get_or_404(session, provider_id=provider_id, graph_id=graph.id)
    await services.delete_provider(session, provider=provider)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@llm_providers_router.post("/{provider_id}/ping", response_model=LLMPingResponse)
async def ping_llm_provider(
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMPingResponse:
    provider = await services.get_or_404(session, provider_id=provider_id, graph_id=graph.id)
    result = await services.ping_provider(provider=provider, encryption_key=settings.encryption_key)
    return LLMPingResponse(**result)


@llm_providers_router.post("/{provider_id}/set-default", response_model=LLMProviderRead)
async def set_default_llm_provider(
    provider_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LLMProviderRead:
    provider = await services.get_or_404(session, provider_id=provider_id, graph_id=graph.id)
    updated = await services.set_default(session, provider=provider)
    await session.commit()
    await session.refresh(updated)
    return _to_read(updated)
