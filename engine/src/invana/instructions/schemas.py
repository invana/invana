"""Pydantic request/response models for the Instructions API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class InstructionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    content: str = Field(default="")
    priority: int = Field(default=100, ge=0, le=1000)


class InstructionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    priority: int | None = Field(default=None, ge=0, le=1000)


class InstructionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    name: str
    content: str
    priority: int
    created_at: datetime
    updated_at: datetime


class InstructionListResponse(BaseModel):
    items: list[InstructionRead]
    total: int
