"""Sort DSL for ordering query results."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel


class SortDirection(StrEnum):
    """Sort direction for a single property."""

    ASC = "asc"
    DESC = "desc"


class SortSpec(BaseModel):
    """Order results by a property in a given direction.

    Attributes:
        property: Property name to order by.
        direction: Ascending or descending (defaults to ascending).
    """

    property: str
    direction: SortDirection = SortDirection.ASC
