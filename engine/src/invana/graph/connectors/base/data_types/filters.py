from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel

from invana.graph.connectors.base.data_types.filter_types import FilterOp


class LogicalOp(StrEnum):
    AND = "and"
    OR = "or"


class FilterExpression(BaseModel):
    property: str
    op: FilterOp
    value: Any = None


class FilterGroup(BaseModel):
    """Recursive filter tree supporting nested AND/OR groups."""

    operator: LogicalOp = LogicalOp.AND
    conditions: list[FilterExpression | FilterGroup] = []
