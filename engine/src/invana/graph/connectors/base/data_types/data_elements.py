from typing import Any, Literal

from pydantic import BaseModel


class Vertex(BaseModel):
    id: str
    label: str
    properties: dict[str, Any] = {}


class Edge(BaseModel):
    id: str
    label: str
    source: str
    target: str
    properties: dict[str, Any] = {}


class Path(BaseModel):
    vertices: list[Vertex]
    edges: list[Edge]


class ResultMetadata(BaseModel):
    node_count: int = 0
    edge_count: int = 0
    record_count: int = 0
    duration_ms: float = 0.0


class GraphResponse(BaseModel):
    nodes: list[Vertex] = []
    edges: list[Edge] = []
    records: list[dict[str, Any]] = []
    metadata: ResultMetadata = ResultMetadata()


class QueryResult(BaseModel):
    id: str
    status: Literal["completed", "error"]
    duration_ms: float
    language: Literal["cypher", "gremlin"]
    result: GraphResponse | None = None
    error: str | None = None
