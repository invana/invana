from typing import Literal

from pydantic import BaseModel


class PropertyDefinition(BaseModel):
    name: str
    type: str  # "string", "integer", "float", "boolean", "datetime", "list[T]"
    required: bool = False
    unique: bool = False


class NodeType(BaseModel):
    name: str
    description: str = ""
    properties: list[PropertyDefinition] = []


class EdgeType(BaseModel):
    name: str
    description: str = ""
    source: str
    target: str
    properties: list[PropertyDefinition] = []
    cardinality: Literal["one-to-one", "one-to-many", "many-to-many"] = "many-to-many"


class IndexInfo(BaseModel):
    name: str
    label: str
    properties: list[str]
    type: Literal["btree", "fulltext", "vector", "composite"]


class ConstraintInfo(BaseModel):
    name: str
    label: str
    properties: list[str]
    type: Literal["unique", "exists", "node_key"]
