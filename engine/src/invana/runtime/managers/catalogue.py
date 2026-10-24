"""The catalogue, as a person reads it (docs/for-developers/modules/workflows/features/the-catalogue.md).

Band 3, because the declaration is the runtime's: the read is the registry
rendered, plus the one fact only a Graph can answer — how many of its reusable
plans name each entry. Nothing here adds, edits or disables an entry.

The registry is in memory, so the list is narrowed here and paged by
:func:`page_of_rows` over the entry's key, which is unique::

    entries, info = await CatalogueManager().page(session, graph_id=graph.id, params=params)
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.task_plans.querysets import TaskPlanQuerySet
from invana.core.lists import ListParams, PageInfo, page_of_rows
from invana.plugins.sdk.manifest import Bound, Entry
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.schemas import (
    CatalogueArgRead,
    CatalogueEntryRead,
    CatalogueOutputRead,
)

_BOUND_ORDER = {bound.value: i for i, bound in enumerate(Bound)}


def _entry_read(entry: Entry, used_by: int) -> CatalogueEntryRead:
    return CatalogueEntryRead(
        step_key=entry.key,
        bound=entry.bound.value,
        summary=entry.summary,
        args=[
            CatalogueArgRead(name=name, type=arg.type.value, required=arg.required, default=arg.default)
            for name, arg in entry.args.items()
        ],
        outputs=[
            CatalogueOutputRead(name=name, type=type_.value, rollup=type_.aggregation)
            for name, type_ in entry.outputs.items()
        ],
        requires=list(entry.requires),
        used_by=used_by,
        plugin=entry.plugin,
    )


class CatalogueManager:
    plans = TaskPlanQuerySet()

    async def page(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[list[CatalogueEntryRead], PageInfo]:
        """One page of the catalogue, searched, filtered and sorted by ``params``.

        Sorting by ``bound`` groups the entries in the bound's declared order,
        then by key; ``key`` sorts by key alone.
        """
        entries = list(CATALOGUE.values())
        rows = entries
        if bounds := params.values("bound"):
            rows = [e for e in rows if e.bound.value in bounds]
        if plugins := params.values("plugin"):
            rows = [e for e in rows if e.plugin in plugins]
        if params.q:
            q = params.q.lower()
            rows = [e for e in rows if q in e.key.lower() or q in e.summary.lower()]
        page, info = page_of_rows(
            rows,
            params,
            unfiltered_total=len(entries),
            sorts={"bound": lambda e: _BOUND_ORDER[e.bound.value], "key": lambda e: e.key},
            id_of=lambda e: e.key,
        )
        used = await self.plans.step_key_usage(session, graph_id=graph_id) if page else {}
        return [_entry_read(entry, used.get(entry.key, 0)) for entry in page], info
