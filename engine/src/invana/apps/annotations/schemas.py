"""Pydantic request/response models for annotations
(docs/for-developers/modules/explore/features/annotations.md § Engine)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

AnnotationKind = Literal["note", "value", "highlight", "group"]
AnnotationColor = Literal["amber", "blue", "green", "red", "grey"]
AnnotationReach = Literal["session", "graph"]
AnnotationScope = Literal["session", "graph", "all"]


class AnnotationRecord(BaseModel):
    """A record an annotation is on — the database's element id."""

    id: str = Field(min_length=1, max_length=255)
    kind: Literal["node", "edge"] = "node"
    label: str = Field(default="", max_length=255)


class AnnotationCreate(BaseModel):
    """Write an annotation. The record count must fit the kind (AN1)."""

    kind: AnnotationKind
    records: list[AnnotationRecord] = Field(min_length=1, max_length=500)
    prop: str | None = Field(default=None, max_length=255)
    value_then: Any = None
    text: str = Field(default="", max_length=4000)
    label: str = Field(default="", max_length=255)
    color: AnnotationColor | None = None
    session_id: str | None = None

    @model_validator(mode="after")
    def _fits_kind(self) -> AnnotationCreate:
        n = len(self.records)
        if self.kind in ("note", "value") and n != 1:
            raise ValueError(f"A {self.kind} annotation is on exactly one record.")
        if self.kind in ("highlight", "group") and any(r.kind != "node" for r in self.records):
            raise ValueError(f"A {self.kind} is on nodes.")
        if self.kind == "group" and n < 2:
            raise ValueError("A group holds two or more records.")
        if self.kind == "value" and not self.prop:
            raise ValueError("A value annotation names its property.")
        if self.kind != "value" and self.prop:
            raise ValueError("Only a value annotation names a property.")
        if self.kind in ("note", "value") and not self.text.strip():
            raise ValueError("An annotation says something.")
        return self


class AnnotationUpdate(BaseModel):
    """Change what it says or how it looks. ``reach`` only goes from ``session`` to ``graph``."""

    text: str | None = Field(default=None, max_length=4000)
    label: str | None = Field(default=None, max_length=255)
    color: AnnotationColor | None = None
    reach: Literal["graph"] | None = None


class AnnotationAuthor(BaseModel):
    id: str | None
    name: str
    kind: Literal["user", "assistant"]


class AnnotationDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: AnnotationKind
    records: list[AnnotationRecord]
    prop: str | None
    value_then: Any
    text: str
    label: str
    color: AnnotationColor
    author: AnnotationAuthor
    session_id: str | None
    message_id: str | None
    reach: AnnotationReach
    promoted_by_id: str | None
    evidence: dict | None
    created_at: datetime
    updated_at: datetime


class AnnotationListResponse(BaseModel):
    items: list[AnnotationDetail]
    total: int
