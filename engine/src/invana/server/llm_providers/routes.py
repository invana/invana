"""Paths for graph-scoped LLM providers, all under
``/api/v1/u/{username}/{graphSlug}/llm``.

=====================================  ==========================================
GET · POST ``""``                      list · create
GET · PATCH · DELETE ``/{id}``         detail · update — a **rename** is refused while a world names it
                                       (re-encrypts only if a key is supplied) · hard delete
POST ``/{id}/ping``                    credential test, on the first model offered
GET · POST ``/{id}/models``            what this endpoint offers · offer one more
DELETE ``/{id}/models/{model_row_id}`` stop offering one — refused while a cast names it
=====================================  ==========================================

**No ``set-default``**: the lens ``cast`` answers *which model when nobody said*
([PM4](docs/for-developers/modules/agents/features/providers-and-models.md)).

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.llm_providers.schemas import (
    LLMModelListResponse,
    LLMModelRead,
    LLMPingResponse,
    LLMProviderListResponse,
    LLMProviderRead,
)
from invana.server.llm_providers import views

llm_providers_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/llm",
    tags=["llm-providers"],
)

llm_providers_router.get("", response_model=LLMProviderListResponse)(views.list_llm_providers)
llm_providers_router.post("", response_model=LLMProviderRead, status_code=status.HTTP_201_CREATED)(
    views.create_llm_provider
)
llm_providers_router.get("/{provider_id}", response_model=LLMProviderRead)(views.get_llm_provider)
llm_providers_router.patch("/{provider_id}", response_model=LLMProviderRead)(views.update_llm_provider)
llm_providers_router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_llm_provider)
llm_providers_router.post("/{provider_id}/ping", response_model=LLMPingResponse)(views.ping_llm_provider)
llm_providers_router.get("/{provider_id}/models", response_model=LLMModelListResponse)(views.list_llm_models)
llm_providers_router.post("/{provider_id}/models", response_model=LLMModelRead, status_code=status.HTTP_201_CREATED)(
    views.add_llm_model
)
llm_providers_router.delete("/{provider_id}/models/{model_row_id}", status_code=status.HTTP_204_NO_CONTENT)(
    views.remove_llm_model
)
