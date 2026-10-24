"""The same page over rows already in memory.

The plugin registry and the task-type catalogue are built from frozen
manifests, not a table, so there is no statement to cut. The manager filters
the rows itself; this sorts by the requested key then the id, resumes after the
cursor and takes ``limit`` — the same keyset contract a SQL list keeps.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any, TypeVar

from invana.core.lists.params import ListParams, encode_cursor
from invana.core.lists.schemas import PageInfo

RowT = TypeVar("RowT")


def page_of_rows(
    rows: Sequence[RowT],
    params: ListParams,
    *,
    unfiltered_total: int,
    sorts: Mapping[str, Callable[[RowT], Any]],
    id_of: Callable[[RowT], str],
) -> tuple[list[RowT], PageInfo]:
    """One page of ``rows`` — already narrowed by ``q`` and the filters — in ``params.sort`` order."""
    key = sorts[params.sort_key]
    ordered = sorted(rows, key=lambda r: (key(r), id_of(r)), reverse=params.descending)
    after = params.after()
    if after is not None:
        mark = (after[0], after[1])
        if params.descending:
            ordered = [r for r in ordered if (key(r), id_of(r)) < mark]
        else:
            ordered = [r for r in ordered if (key(r), id_of(r)) > mark]
    page = ordered[: params.limit]
    next_cursor = None
    if len(ordered) > params.limit:
        last = page[-1]
        next_cursor = encode_cursor(params.sort, key(last), id_of(last))
    return page, PageInfo(total=len(rows), unfiltered_total=unfiltered_total, next_cursor=next_cursor)
