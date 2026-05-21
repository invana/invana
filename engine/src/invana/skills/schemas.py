"""Pydantic request/response models for the Skills API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    content: str = Field(default="")
    when_to_use: str = Field(default="")


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    content: str | None = None
    when_to_use: str | None = None


class SkillRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    name: str
    description: str
    content: str
    when_to_use: str
    created_at: datetime
    updated_at: datetime


class SkillListResponse(BaseModel):
    items: list[SkillRead]
    total: int
