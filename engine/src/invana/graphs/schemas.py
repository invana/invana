"""Pydantic request and response models for the Graph API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from invana.graph.types.data_elements import GraphResponse


class GraphCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    uri: str = Field(..., min_length=1, max_length=2048)
    connector_class: str = Field(..., min_length=1, max_length=512)
    auth: dict = Field(default_factory=dict)
    read_only: bool = False


class GraphUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    uri: str | None = Field(default=None, min_length=1, max_length=2048)
    auth: dict | None = None  # if provided, re-encrypts and triggers reconnect
    read_only: bool | None = None
    # connector_class is intentionally excluded — immutable once schema is seeded


class GraphRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    uri: str
    connector_class: str
    read_only: bool
    status: str
    schema_id: str | None
    last_health_check_at: datetime | None
    latency_ms: int | None
    created_at: datetime
    updated_at: datetime
    # auth_encrypted is intentionally excluded — credentials are never returned


class GraphListResponse(BaseModel):
    items: list[GraphRead]
    total: int


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1)
    parameters: dict = Field(default_factory=dict)
    timeout_ms: int = Field(default=10000, gt=0)


class QueryResponse(BaseModel):
    result_type: str  # "graph" | "tabular"
    query_language: str  # "cypher" | "gremlin"
    data: GraphResponse | None = None  # serialised nodes/edges/records when result_type="graph"
    rows: list[dict] | None = None  # raw rows when result_type="tabular"
    execution_time_ms: int
    row_count: int
