"""The shape every list answers with.

``total`` counts every row that matches; ``unfiltered_total`` counts the list
with no ``q`` and no filters — the board's *2 of 61 match*. Both are counts the
engine ran, never ``len(items)``. ``applied`` echoes each filter the engine
used with the words a person reads, so Studio's chips and the assistant's reply
name the same filters.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

from invana.core.lists.params import ListParams, ListSpec

ItemT = TypeVar("ItemT")


class AppliedFilter(BaseModel):
    """One filter the engine applied. ``q`` is echoed as field ``q``."""

    field: str
    #: The chip's words before the value — ``agent`` for ``agent_id``.
    title: str
    value: str
    #: The value as a person reads it — an agent's name for its id.
    label: str


class Page(BaseModel, Generic[ItemT]):
    """One page of a list."""

    items: list[ItemT]
    total: int
    unfiltered_total: int
    next_cursor: str | None = None
    applied: list[AppliedFilter] = Field(default_factory=list)

    @classmethod
    def of(cls, items: list[ItemT], info: PageInfo, applied: list[AppliedFilter]) -> Page[ItemT]:
        """A page from its reads, what the queryset counted, and the echoed filters."""
        return cls(
            items=items,
            total=info.total,
            unfiltered_total=info.unfiltered_total,
            next_cursor=info.next_cursor,
            applied=applied,
        )


@dataclass(frozen=True)
class PageInfo:
    """What a queryset learned paging a list, before its rows become reads."""

    total: int
    unfiltered_total: int
    next_cursor: str | None


def applied_filters(
    params: ListParams,
    spec: ListSpec,
    labels: Mapping[str, Mapping[str, str] | Callable[[str], str | None]] | None = None,
) -> list[AppliedFilter]:
    """Echo the filters a request applied, each value labelled.

    A filter's own ``labels`` name an enum's values; ``labels`` here names
    values only the caller can resolve (an agent id → its name). A value that
    resolves to nothing is labelled with itself.
    """
    out: list[AppliedFilter] = []
    if params.q:
        out.append(AppliedFilter(field="q", title=spec.search_title, value=params.q, label=params.q))
    extra = labels or {}
    for name, values in params.filters.items():
        rule = spec.filters[name]
        resolve = extra.get(name)
        for value in values:
            label = rule.labels.get(value)
            if label is None and resolve is not None:
                label = resolve(value) if callable(resolve) else resolve.get(value)
            out.append(
                AppliedFilter(
                    field=name,
                    title=rule.title or name.replace("_", " "),
                    value=value,
                    label=label or value,
                )
            )
    return out
