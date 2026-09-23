"""Pydantic request/response models for the LLM providers API.

A provider is a **configured endpoint**; the models it offers are a
sub-resource ([PM9](docs/for-developers/modules/agents/features/providers-and-models.md)).
There is no ``is_default`` anywhere here — the lens ``cast`` answers *which
model when nobody said* ([PM4](docs/for-developers/modules/agents/features/providers-and-models.md)).
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from invana.apps.llm_providers.endpoint import LLMEndpoint
from invana.apps.llm_providers.models import (
    LLMCredentialKind,
    LLMModel,
    LLMModelStatus,
    LLMProvider,
    LLMProviderKind,
)

#: The address segment: lowercase words, digits, hyphens and underscores. A rule
#: is written against it and a refusal reads it back, so it stays a slug rather
#: than a sentence (PM10). The underscore is here because migration ``53``
#: named every backfilled endpoint after its vendor kind, and
#: ``claude_agent_sdk`` is one of them: a name the address grammar accepts and
#: this pattern rejected could not be saved back by the form that showed it
#: ([PM19](docs/for-developers/modules/agents/features/providers-and-models.md)).
_NAME_PATTERN = r"^[a-z0-9][a-z0-9_-]*$"


class LLMModelCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str = Field(..., min_length=1, max_length=255)
    display_name: str | None = Field(default=None, max_length=255)
    capabilities: dict = Field(default_factory=dict)
    pricing: dict = Field(default_factory=dict)


class LLMProviderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64, pattern=_NAME_PATTERN)
    provider: LLMProviderKind
    api_key: str | None = Field(default=None, min_length=1)
    # claude_agent_sdk only (docs/for-developers/modules/agents/features/providers-and-models.md) — disambiguates what
    # `api_key` holds.
    # Rejected on every other provider kind.
    credential_kind: LLMCredentialKind | None = None
    base_url: str | None = Field(default=None, max_length=2048)
    guardrails: dict = Field(default_factory=dict)
    #: Added with the endpoint, so configuring one is one round trip rather than
    #: a provider that offers nothing until a second call lands.
    models: list[LLMModelCreate] = Field(default_factory=list)


class LLMProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64, pattern=_NAME_PATTERN)
    # If provided, re-encrypts; if omitted, leaves stored key untouched.
    api_key: str | None = Field(default=None, min_length=1)
    # claude_agent_sdk only (docs/for-developers/modules/agents/features/providers-and-models.md); see
    # LLMProviderCreate.
    credential_kind: LLMCredentialKind | None = None
    base_url: str | None = Field(default=None, max_length=2048)
    guardrails: dict | None = None
    # `provider` is intentionally excluded — immutable once set.


class LLMModelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: str
    provider_id: str
    model_id: str
    display_name: str | None
    capabilities: dict
    pricing: dict
    status: LLMModelStatus
    #: ``llm/<provider name>/<model id>`` — what a rule names and a touch records.
    address: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def of(cls, provider: LLMProvider, model: LLMModel) -> LLMModelRead:
        """A model reads with its address, which needs its provider's name — so
        it is built from the pair rather than validated off one row."""
        return cls(
            id=model.id,
            provider_id=model.provider_id,
            model_id=model.model_id,
            display_name=model.display_name,
            capabilities=model.capabilities or {},
            pricing=model.pricing or {},
            status=LLMModelStatus(model.status),
            address=LLMEndpoint(row=provider, model=model).address,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class LLMProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    name: str
    provider: LLMProviderKind
    has_api_key: bool
    credential_kind: LLMCredentialKind | None
    base_url: str | None
    guardrails: dict
    #: The models this endpoint offers. A provider row alone answers nothing.
    models: list[LLMModelRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @classmethod
    def of(cls, provider: LLMProvider, models: Sequence[LLMModel]) -> LLMProviderRead:
        read = cls.model_validate(provider)
        read.models = [LLMModelRead.of(provider, m) for m in models]
        return read


class LLMProviderListResponse(BaseModel):
    items: list[LLMProviderRead]
    total: int


class LLMModelListResponse(BaseModel):
    items: list[LLMModelRead]
    total: int


class LLMPingResponse(BaseModel):
    ok: bool
    latency_ms: int | None = None
    error: str | None = None
