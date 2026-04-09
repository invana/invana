"""Core graph data element models.

All models are Pydantic BaseModel subclasses used as the canonical
return types across every connector implementation.
"""

from typing import Any, Literal

from pydantic import BaseModel


class Vertex(BaseModel):
    """A graph node.

    Attributes:
        id: Database-assigned element ID.
        label: Node label (e.g. ``"Person"``).
        properties: Key-value property map.
    """

    id: str
    label: str
    properties: dict[str, Any] = {}


class Edge(BaseModel):
    """A directed graph relationship.

    Attributes:
        id: Database-assigned element ID.
        label: Relationship type (e.g. ``"KNOWS"``).
        source: Element ID of the source vertex.
        target: Element ID of the target vertex.
        properties: Key-value property map.
    """

    id: str
    label: str
    source: str
    target: str
    properties: dict[str, Any] = {}


class Path(BaseModel):
    """An ordered sequence of vertices connected by edges.

    Attributes:
        vertices: Ordered vertices in the path.
        edges: Edges connecting consecutive vertices.
    """

    vertices: list[Vertex]
    edges: list[Edge]


class ResultMetadata(BaseModel):
    """Metadata about a query result.

    Attributes:
        node_count: Number of nodes in the result.
        edge_count: Number of edges in the result.
        record_count: Number of raw records returned.
        duration_ms: Query execution duration in milliseconds.
    """

    node_count: int = 0
    edge_count: int = 0
    record_count: int = 0
    duration_ms: float = 0.0


class GraphResponse(BaseModel):
    """Structured response from graph queries.

    Attributes:
        nodes: All vertices in the result.
        edges: All edges in the result.
        records: Raw records from the query.
        metadata: Aggregated result metadata.
    """

    nodes: list[Vertex] = []
    edges: list[Edge] = []
    records: list[dict[str, Any]] = []
    metadata: ResultMetadata = ResultMetadata()


class QueryResult(BaseModel):
    """Wrapper for a completed query execution.

    Attributes:
        id: Query execution ID.
        status: ``"completed"`` or ``"error"``.
        duration_ms: Execution duration in milliseconds.
        language: Query language used.
        result: Graph response (if completed).
        error: Error message (if errored).
    """

    id: str
    status: Literal["completed", "error"]
    duration_ms: float
    language: Literal["cypher", "gremlin"]
    result: GraphResponse | None = None
    error: str | None = None
