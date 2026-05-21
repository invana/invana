"""Pydantic request/response models for the Graph + GraphConnection APIs.

The ``Graph*`` shapes back the new Graph-container surface introduced in S2
(``/api/v1/graphs`` + ``/api/v1/u/{username}/{slug}``). The ``GraphConnection*``
shapes back the legacy ``/api/v1/graph-connections/*`` surface, which will be
removed once the studio fully migrates to graph-scoped connection routes
under ``/u/{username}/{slug}/connection``.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from invana.graph.types.data_elements import GraphResponse
from invana.graphs.models import GraphStatus

# Slug validation mirrors username: lowercase letters, digits, hyphens; no
# leading/trailing hyphen. Per RFC-017 slug is unique per owner.
GRAPH_SLUG_PATTERN = r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
GRAPH_SLUG_MIN = 2
GRAPH_SLUG_MAX = 64


# ---------------------------------------------------------------------------
# Graph container (RFC-017)
# ---------------------------------------------------------------------------


class GraphCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=GRAPH_SLUG_MIN, max_length=GRAPH_SLUG_MAX, pattern=GRAPH_SLUG_PATTERN)
    intent: str | None = Field(default=None, max_length=10000)


class GraphUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    intent: str | None = Field(default=None, max_length=10000)
    objectives: str | None = None
    success_criteria: str | None = None
    status: GraphStatus | None = None
    # slug is not editable here — would break /u/{username}/{slug} URLs.


class GraphRead(BaseModel):
    """Graph container payload — used by /api/v1/graphs and /u/{username}/{slug}."""

    id: str
    slug: str
    name: str
    description: str | None
    intent: str | None
    objectives: str | None
    success_criteria: str | None
    setup_state: dict
    status: GraphStatus
    owner_id: str
    owner_username: str
    member_count: int
    has_connection: bool
    created_at: datetime
    updated_at: datetime


class GraphListResponse(BaseModel):
    items: list[GraphRead]
    total: int


# ---------------------------------------------------------------------------
# Setup wizard
# ---------------------------------------------------------------------------

# Sections in the order they appear in the wizard. graph_info + intent are
# REQUIRED (gate the modeller/explorer/query routes); skills + datasets are
# SKIPPABLE.
SETUP_SECTIONS = ("graph_info", "intent", "skills", "datasets")
SETUP_REQUIRED = ("graph_info", "intent")
SETUP_SKIPPABLE = ("skills", "datasets")


class SetupSectionUpdate(BaseModel):
    """POST /u/{username}/{slug}/setup/{section} body."""

    action: str = Field(..., pattern=r"^(complete|skip|reset)$")


# ---------------------------------------------------------------------------
# GraphConnection (1:1 child of Graph)
# ---------------------------------------------------------------------------


class GraphConnectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    uri: str = Field(..., min_length=1, max_length=2048)
    connector_class: str = Field(..., min_length=1, max_length=512)
    auth: dict = Field(default_factory=dict)
    read_only: bool = False


class GraphConnectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    uri: str | None = Field(default=None, min_length=1, max_length=2048)
    auth: dict | None = None  # if provided, re-encrypts and triggers reconnect
    read_only: bool | None = None
    # connector_class is intentionally excluded — immutable once schema is seeded


class GraphConnectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str | None
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


class GraphConnectionListResponse(BaseModel):
    items: list[GraphConnectionRead]
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
