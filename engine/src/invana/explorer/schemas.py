"""Request/response schemas for the Explorer node-expand APIs (RFC-035)."""

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
    # The session this expand belongs to (RFC-046). When set (and owned by the
    # caller in this graph), the expand is logged as a turn in that session's
    # thread. Optional so an expand with no active session still works.
    session_id: str | None = None


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
