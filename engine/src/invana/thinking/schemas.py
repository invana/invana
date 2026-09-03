"""Pydantic read/request models for thinkings (RFC-055)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ThinkingStepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    thinking_id: str
    message_id: str | None = None
    seq: int
    task_key: str
    label: str
    attempt: int
    status: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    detail: str = ""
    input: dict | None = None
    output: dict | None = None
    error: dict | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None


class ThinkingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    thought_id: str
    graph_id: str
    workflow_key: str
    status: str
    assistant_message_id: str | None = None
    queued_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: dict | None = None
    stream_seq: int
    steps: list[ThinkingStepRead] = []


class ResumeThinking(BaseModel):
    """The user's answer to a clarification (RFC-048 pause / resume)."""

    answer: str = Field(..., min_length=1)


class CancelResponse(BaseModel):
    id: str
    status: str
