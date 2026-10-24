"""What a list takes — its spec, the parsed request, and the cursor.

A :class:`ListSpec` names every filter a list accepts and every sort it offers;
:func:`list_params` turns a request's query string into :class:`ListParams`
against it, refusing anything the list does not take with a 422 that names the
field and the choices. The API uses plain field names (``?status=failed``);
Studio's address bar prefixes them (``?f.status=``) and strips the prefix
before it calls.

The cursor is keyset and opaque: the last row's sort value and id, base64'd,
together with the sort it was made for — a cursor sent with another sort is
refused rather than read against the wrong column.
"""

from __future__ import annotations

import base64
import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from fastapi import Request

from invana.core.errors import ValidationError

#: Query parameters every list reads itself; any other key is a filter.
RESERVED = frozenset({"q", "sort", "cursor", "limit"})
DEFAULT_LIMIT = 50
MAX_LIMIT = 200


@dataclass(frozen=True)
class Filter:
    """One named filter. ``values`` closes it to an enum; ``labels`` names each value for a chip."""

    values: tuple[str, ...] | None = None
    labels: Mapping[str, str] = field(default_factory=dict)
    #: The words on the chip before the value — ``agent`` for ``agent_id``.
    title: str | None = None


@dataclass(frozen=True)
class ListSpec:
    """The filters and sorts one list accepts. The first sort is the default."""

    filters: Mapping[str, Filter] = field(default_factory=dict)
    sorts: tuple[str, ...] = ("name",)
    #: Query parameters the endpoint reads itself and are not filters (``mine``).
    extra: frozenset[str] = frozenset()
    #: The chip's words for ``q`` — what the search box matches (``name``).
    search_title: str = "search"

    @property
    def default_sort(self) -> str:
        return self.sorts[0]


@dataclass(frozen=True)
class ListParams:
    """A list request, parsed and checked against its spec."""

    q: str | None = None
    filters: Mapping[str, tuple[str, ...]] = field(default_factory=dict)
    sort: str = "name"
    cursor: str | None = None
    limit: int = DEFAULT_LIMIT

    def values(self, name: str) -> tuple[str, ...]:
        """Every value of one filter, empty when it is not applied."""
        return self.filters.get(name, ())

    def one(self, name: str) -> str | None:
        """The filter's value when it takes one; the first when given several."""
        got = self.filters.get(name)
        return got[0] if got else None

    @property
    def is_filtered(self) -> bool:
        return bool(self.q) or bool(self.filters)

    @property
    def sort_key(self) -> str:
        """The sort's field name, without the direction."""
        return self.sort.lstrip("-")

    @property
    def descending(self) -> bool:
        return self.sort.startswith("-")

    def after(self) -> tuple[Any, str] | None:
        """The (sort value, id) the cursor stands after, or ``None`` on the first page."""
        if not self.cursor:
            return None
        try:
            raw = json.loads(base64.urlsafe_b64decode(self.cursor.encode()).decode())
            sort, kind, value, row_id = raw
        except (ValueError, TypeError):
            raise ValidationError("cursor is not one this list made") from None
        if sort != self.sort:
            raise ValidationError(f"cursor was made for sort {sort}, not {self.sort}")
        if kind == "dt":
            value = datetime.fromisoformat(value)
        return value, row_id


def encode_cursor(sort: str, value: Any, row_id: str) -> str:
    """The cursor that resumes after a row with this sort value and id."""
    kind, out = ("dt", value.isoformat()) if isinstance(value, datetime) else ("v", value)
    return base64.urlsafe_b64encode(json.dumps([sort, kind, out, row_id]).encode()).decode()


def parse_list_params(spec: ListSpec, query: Mapping[str, list[str]]) -> ListParams:
    """Check a query string against a spec. Raises ``ValidationError`` naming what is wrong."""
    filters: dict[str, tuple[str, ...]] = {}
    for name, given in query.items():
        if name in RESERVED or name in spec.extra:
            continue
        rule = spec.filters.get(name)
        if rule is None:
            takes = ", ".join(sorted(spec.filters)) or "none"
            raise ValidationError(f"{name} is not a filter of this list; it takes: {takes}")
        values = tuple(v for v in given if v != "")
        if rule.values is not None:
            bad = [v for v in values if v not in rule.values]
            if bad:
                raise ValidationError(f"{name} cannot be {bad[0]}; it is one of: {', '.join(rule.values)}")
        if values:
            filters[name] = values

    sort = (query.get("sort") or [spec.default_sort])[0] or spec.default_sort
    if sort not in spec.sorts:
        raise ValidationError(f"sort cannot be {sort}; it is one of: {', '.join(spec.sorts)}")

    raw_limit = (query.get("limit") or [str(DEFAULT_LIMIT)])[0]
    try:
        limit = int(raw_limit)
    except ValueError:
        raise ValidationError(f"limit must be a number from 1 to {MAX_LIMIT}") from None
    if not 1 <= limit <= MAX_LIMIT:
        raise ValidationError(f"limit must be a number from 1 to {MAX_LIMIT}")

    q = ((query.get("q") or [""])[0]).strip() or None
    cursor = (query.get("cursor") or [""])[0] or None
    params = ListParams(q=q, filters=filters, sort=sort, cursor=cursor, limit=limit)
    params.after()  # refuse a cursor for another sort now, not mid-query
    return params


def list_params(spec: ListSpec) -> Callable[[Request], ListParams]:
    """The FastAPI dependency a list view takes: ``Depends(list_params(SPEC))``."""

    def dependency(request: Request) -> ListParams:
        query = {k: request.query_params.getlist(k) for k in request.query_params}
        return parse_list_params(spec, query)

    return dependency
