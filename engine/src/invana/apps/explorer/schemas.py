"""Request/response schemas for the Explorer node-expand APIs
(docs/for-developers/modules/explore/features/graph-canvas.md)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from invana.graph.types.data_elements import GraphResponse
from invana.graph.types.filters import FilterGroup
from invana.graph.types.sort import SortSpec


class _ExpandBase(BaseModel):
    """Shared fields for every expand request.

    ``filters`` / ``sort`` / ``limit`` / ``offset`` apply to the **neighbour**,
    so large neighbourhoods can be sliced to the meaningful page.
    """

    vertex_id: str = Field(..., min_length=1)
    direction: Literal["in", "out", "both"] = "both"
    filters: FilterGroup | None = None
    sort: list[SortSpec] = Field(default_factory=list)
    limit: int = Field(default=50, gt=0, le=500)
    offset: int = Field(default=0, ge=0)
    # The session this expand belongs to (docs/for-developers/modules/explore/features/boards.md). When set (and owned
    # by the caller in this graph), the expansion's run is a turn in that
    # session's thread, and the session's agent narrows its lens (GC11 · GC12).
    # Optional so an expand with no active session still works.
    session_id: str | None = None
    #: The world the canvas has picked, exactly as an ask's ``lens_id`` (GC11).
    #: ``None`` is no world — the Graph's guardrails, and the agent's own world.
    lens_id: str | None = None


class ExpandNeighborsRequest(_ExpandBase):
    """Expand all neighbours of a vertex (any edge type, any neighbour label)."""


class ExpandByEdgeTypeRequest(_ExpandBase):
    """Expand neighbours reached via a specific edge/relationship type."""

    edge_label: str = Field(..., min_length=1)


class ExpandByNodeTypeRequest(_ExpandBase):
    """Expand neighbours of a specific node type (label)."""

    neighbor_label: str = Field(..., min_length=1)


class NeighborExpandResponse(BaseModel):
    """The neighbour slice plus pagination metadata for "showing X of N"."""

    data: GraphResponse
    total: int
    offset: int
    limit: int
    returned: int
    has_more: bool
    #: The ``expand-neighbours@1`` run this answer came from (GC12).
    run_id: str | None = None


class ResolveElementsRequest(BaseModel):
    """Which of these ids does the graph still hold, inside the picked world?

    A canvas reopens from its own snapshot, and the graph may have moved on. An
    element that is gone is **kept and marked missing**
    (docs/for-developers/modules/explore/features/graph-canvas.md GC5) rather than
    dropped: a drawing that quietly loses a node is a drawing that lies about what
    was explored. One the world excludes is in neither list (GC14).
    """

    vertex_ids: list[str] = Field(default_factory=list, max_length=5000)
    #: The world the canvas has picked. What it excludes is in neither list
    #: and is not drawn (graph-canvas.md GC14).
    lens_id: str | None = None


class ResolveElementsResponse(BaseModel):
    present: list[str] = Field(default_factory=list)
    #: Asked for and not found — the ones the canvas marks missing.
    missing: list[str] = Field(default_factory=list)
    checked: int = 0
    #: The ``resolve-elements@1`` run, when the canvas held anything to check.
    run_id: str | None = None


class TypeCount(BaseModel):
    """One type and how many of it the graph holds.

    ``count`` is ``None`` when the vendor cannot count
    (selection-and-the-panel.md SP8) — the type is still named, because a list
    with no numbers is still the canvas legend.
    """

    name: str
    count: int | None = None


class TypeCountsResponse(BaseModel):
    """Every node and edge type in the graph, biggest first.

    Graph-wide, not canvas-wide (SP6): the panel answers "what does this graph
    hold", the status bar answers "what am I looking at".
    """

    nodes: list[TypeCount] = Field(default_factory=list)
    edges: list[TypeCount] = Field(default_factory=list)
    #: False when the vendor could not count; every ``count`` is then ``None``.
    counted: bool = True
    #: The ``count-types@1`` run these came from (SP11).
    run_id: str | None = None
