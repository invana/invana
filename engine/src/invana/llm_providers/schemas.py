"""Pydantic request/response models for the LLM providers API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from invana.llm_providers.models import LLMProviderKind


class LLMProviderCreate(BaseModel):
    provider: LLMProviderKind
    model_id: str = Field(..., min_length=1, max_length=255)
    api_key: str | None = Field(default=None, min_length=1)
    base_url: str | None = Field(default=None, max_length=2048)
    guardrails: dict = Field(default_factory=dict)
    is_default: bool = False


class LLMProviderUpdate(BaseModel):
    model_id: str | None = Field(default=None, min_length=1, max_length=255)
    # If provided, re-encrypts; if omitted, leaves stored key untouched.
    api_key: str | None = Field(default=None, min_length=1)
    base_url: str | None = Field(default=None, max_length=2048)
    guardrails: dict | None = None
    is_default: bool | None = None
    # `provider` is intentionally excluded — immutable once set.


class LLMProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    provider: LLMProviderKind
    model_id: str
    has_api_key: bool
    base_url: str | None
    guardrails: dict
    is_default: bool
    created_at: datetime
    updated_at: datetime


class LLMProviderListResponse(BaseModel):
    items: list[LLMProviderRead]
    total: int


class LLMPingResponse(BaseModel):
    ok: bool
    latency_ms: int | None = None
    error: str | None = None
