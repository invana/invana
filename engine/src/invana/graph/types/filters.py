"""Filter DSL for building query predicates."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel

from invana.graph.types.filter_types import FilterOp


class LogicalOp(StrEnum):
    """Logical operators for combining filter conditions."""

    AND = "and"
    OR = "or"


class FilterExpression(BaseModel):
    """A single property filter condition.

    Attributes:
        property: Property name to filter on.
        op: Comparison operator.
        value: Value to compare against (not needed for IS_NULL / IS_NOT_NULL).
    """

    property: str
    op: FilterOp
    value: Any = None


class FilterGroup(BaseModel):
    """Recursive filter tree supporting nested AND/OR groups."""

    operator: LogicalOp = LogicalOp.AND
    conditions: list[FilterExpression | FilterGroup] = []
