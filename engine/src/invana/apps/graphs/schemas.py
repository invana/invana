"""Pydantic request/response models for the Graph + GraphConnection APIs.

The ``Graph*`` shapes back the Graph-container surface
(``/api/v1/graphs`` + ``/api/v1/u/{username}/{graphSlug}``). The
``GraphConnection*`` shapes back the graph-scoped connection sub-resource
at ``/u/{username}/{graphSlug}/connection``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, PrivateAttr

from invana.apps.graphs.models import GraphStatus
from invana.graph.types.data_elements import GraphResponse
from invana.graph.types.lens import ComposedQuery

# Slug validation mirrors username: lowercase letters, digits, hyphens; no
# leading/trailing hyphen. Per docs/for-developers/modules/identity-and-access/spec.md slug is unique per owner.
GRAPH_SLUG_PATTERN = r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
GRAPH_SLUG_MIN = 2
GRAPH_SLUG_MAX = 64


# ---------------------------------------------------------------------------
# Graph container (docs/for-developers/modules/identity-and-access/spec.md)
# ---------------------------------------------------------------------------


class GraphCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=GRAPH_SLUG_MIN, max_length=GRAPH_SLUG_MAX, pattern=GRAPH_SLUG_PATTERN)
    instructions: str | None = Field(default=None, max_length=10000)


class GraphUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    instructions: str | None = Field(default=None, max_length=10000)
    status: GraphStatus | None = None
    # The outermost bound
    # (docs/for-developers/modules/agents/features/concurrency-and-contention.md):
    # how many runs run at once here, and what happens at the ceiling.
    max_concurrent_runs: int | None = Field(default=None, ge=0, le=64)
    concurrency_policy: Literal["queue", "refuse"] | None = None
    # slug is not editable here — would break /u/{username}/{graphSlug} URLs.


class GraphRead(BaseModel):
    """Graph container payload — used by /api/v1/graphs and /u/{username}/{graphSlug}."""

    id: str
    slug: str
    name: str
    description: str | None
    instructions: str | None
    setup_state: dict
    status: GraphStatus
    owner_id: str
    owner_username: str
    member_count: int
    has_connection: bool
    max_concurrent_runs: int = 4
    concurrency_policy: str = "queue"
    created_at: datetime
    updated_at: datetime


class GraphListResponse(BaseModel):
    items: list[GraphRead]
    total: int


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

# The sequence a Graph walks from created to answering
# (docs/for-developers/modules/platform/features/setup.md). Sections in the order
# they are drawn. The four required ones are exactly what an answer cannot do
# without; instructions and skills are offers, and are skippable (SU5 · SU15).
SETUP_SECTIONS = ("graph_info", "model", "datasets", "providers", "instructions", "skills")
SETUP_REQUIRED = ("graph_info", "model", "datasets", "providers")
SETUP_SKIPPABLE = ("instructions", "skills")

# Setup is three gates, not one list (SU3). A gate is named for what it unlocks,
# and a surface waits on its own gate rather than on the whole sequence — which
# is why authoring a model is not blocked by having no LLM provider.
SETUP_GATES: dict[str, tuple[str, ...]] = {
    "connected": ("graph_info",),
    "grounded": ("model", "datasets"),
    "answering": ("providers",),
}

# The gate a section belongs to. An optional section belongs to none — it holds
# nothing shut.
SECTION_GATE: dict[str, str | None] = {
    **{section: gate for gate, sections in SETUP_GATES.items() for section in sections},
    "instructions": None,
    "skills": None,
}

# A step that cannot be started until another has landed (SU12). ``--model`` is
# required by every import path and names a published model, so bringing data in
# waits on authoring one.
SECTION_BLOCKED_BY: dict[str, str] = {"datasets": "model"}


class SetupSectionUpdate(BaseModel):
    """POST /u/{username}/{graphSlug}/setup/{section} body.

    ``skip`` on an optional section, ``reset`` to take the skip back. There is no
    ``complete``: a section is done when the thing it asks for exists
    (docs/for-developers/modules/connect-and-model/spec.md CM8/CM9), and a person
    cannot tick it into being.
    """

    action: str = Field(..., pattern=r"^(skip|reset)$")


# ---------------------------------------------------------------------------
# GraphConnection (1:1 child of Graph)
# ---------------------------------------------------------------------------


class GraphConnectionCreate(BaseModel):
    # name/description used to live here but were redundant with the parent
    # Graph's name/description (1:1 relationship). Dropped — humans identify
    # the connection by the graph it belongs to, not by a separate label.
    uri: str = Field(..., min_length=1, max_length=2048)
    connector_class: str = Field(..., min_length=1, max_length=512)
    # Which database on the server to read (connect-a-database.md CD8). Blank/None
    # means "the connector's own default" — it is never treated as "unchanged",
    # that rule belongs to credentials alone.
    database: str | None = Field(default=None, max_length=255)
    auth: dict = Field(default_factory=dict)
    read_only: bool = False
    # Optional manually-declared DB version (docs/for-developers/modules/graph-connectors/features/capabilities.md) —
    # used as a fallback when
    # the backend can't be auto-detected (e.g. Gremlin). A successful auto-detect
    # on connect overrides it; leave blank to rely on detection.
    server_version: str | None = Field(default=None, max_length=32)


class GraphConnectionUpdate(BaseModel):
    uri: str | None = Field(default=None, min_length=1, max_length=2048)
    database: str | None = Field(default=None, max_length=255)
    auth: dict | None = None  # if provided, re-encrypts and triggers reconnect
    read_only: bool | None = None
    # connector_class is intentionally excluded — immutable once schema is seeded


class GraphConnectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str | None
    uri: str
    connector_class: str
    database: str | None
    read_only: bool
    status: str
    model_id: str | None
    last_health_check_at: datetime | None
    latency_ms: int | None
    created_at: datetime
    updated_at: datetime
    # auth_encrypted is intentionally excluded — credentials are never returned

    # Connector-reported capabilities, resolved server-side at response time
    # from the live connector. `capabilities` is the full set (cypher,
    # gremlin, vector_search, fulltext_index, ...); `query_languages` is the
    # cypher/gremlin subset Studio uses to drive its language selector.
    # Empty when the connector isn't currently registered with the manager.
    capabilities: list[str] = Field(default_factory=list)
    query_languages: list[str] = Field(default_factory=list)

    # Backend property-type capabilities + version compatibility
    # (docs/for-developers/modules/graph-connectors/features/capabilities.md).
    # `supported_property_types` drives the modeller's property-type dropdowns;
    # the version/compatibility fields drive the read-only safety valve + banner.
    supported_property_types: list[str] = Field(default_factory=list)
    server_version: str | None = None
    server_version_source: str | None = None
    # Always set to a concrete status in the response (defaults to "unknown").
    compatibility_status: str | None = None
    version_acknowledged: bool = False
    tested_version_range: str | None = None
    effective_read_only: bool = False


class VersionDeclareRequest(BaseModel):
    """POST/PATCH body to declare a server version when auto-detection is unavailable."""

    server_version: str = Field(..., min_length=1, max_length=32)


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

    # What the lens did, when one applied (the-connector-contract.md CC14).
    #
    # It rides here rather than on the result metadata because `data` is None for
    # a tabular result, so half of all answers would carry no record of their own
    # rewrite. It is a **private** attribute because its reader is the trace, in
    # process — the browser has no use for the query text, and the OpenAPI
    # document is the frontend contract rather than a place internals leak into.
    _composed: ComposedQuery | None = PrivateAttr(default=None)

    @property
    def composed(self) -> ComposedQuery | None:
        return self._composed

    def with_composed(self, composed: ComposedQuery | None) -> QueryResponse:
        self._composed = composed
        return self


class ContentionRead(BaseModel):
    """What is running in this Graph and what is waiting behind it.

    Contention has to be **visible**
    (docs/for-developers/modules/agents/features/concurrency-and-contention.md C8):
    what is running, what is queued, and why. Without it, one agent starving the
    Graph looks exactly like the Graph being slow.
    """

    ceiling: int
    policy: str
    running: list[str] = []
    queued: list[dict] = []
    running_count: int = 0
    queued_count: int = 0
    #: Each configured pool, its size and what is in it right now — ``pool`` ·
    #: ``size`` · ``in_use`` (CC8). The run ceiling says how many runs may
    #: proceed; these say how many crossings may be in flight, and a Graph
    #: stalled on `graphdb` with two runs going is invisible without them.
    pools: list[dict] = []
