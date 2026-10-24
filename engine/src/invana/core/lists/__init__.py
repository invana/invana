"""One list contract — every list is searched, filtered, sorted and paged the same way.

A list endpoint declares a :class:`ListSpec` (the filters it takes, the sorts it
offers), takes :class:`ListParams` from :func:`list_params`, and answers
:class:`Page`. Its queryset applies ``q`` and the filters with its own columns,
then hands the statement to ``page_of_select`` for the keyset sort, the limit
and the two counts. A list built in memory (the plugin registry) uses
:func:`page_of_rows` over the same keys.

Usage::

    SPEC = ListSpec(
        filters={"status": Filter(values=("active", "paused"))},
        sorts=("name", "-created_at"),
    )

    async def list_things(params: ListParams = Depends(list_params(SPEC)), ...) -> Page[ThingRead]:
        rows, info = await things.page(session, graph_id=graph.id, params=params)
        return Page[ThingRead].of([ThingRead.model_validate(r) for r in rows], info, applied_filters(params, SPEC))

See ``docs/for-developers/modules/platform/features/list-contract.md``.
"""

from invana.core.lists.params import Filter, ListParams, ListSpec, list_params
from invana.core.lists.rows import page_of_rows
from invana.core.lists.schemas import AppliedFilter, Page, PageInfo, applied_filters

__all__ = [
    "AppliedFilter",
    "Filter",
    "ListParams",
    "ListSpec",
    "Page",
    "PageInfo",
    "applied_filters",
    "list_params",
    "page_of_rows",
]
