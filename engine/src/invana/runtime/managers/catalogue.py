"""The catalogue, as a person reads it (docs/for-developers/modules/workflows/features/the-catalogue.md).

Band 3, because the declaration is the runtime's: the read is the registry
rendered, plus the one fact only a Graph can answer — how many of its reusable
plans name each entry (C9). Nothing here adds, edits or disables an entry (CA1).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.task_plans.querysets import TaskPlanQuerySet
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.catalogue.registry import Bound, Entry
from invana.runtime.schemas import (
    CatalogueArgRead,
    CatalogueEntryRead,
    CatalogueOutputRead,
    CatalogueResponse,
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
    )


class CatalogueManager:
    plans = TaskPlanQuerySet()

    async def list(self, session: AsyncSession, *, graph_id: str) -> CatalogueResponse:
        used = await self.plans.step_key_usage(session, graph_id=graph_id)
        entries = sorted(CATALOGUE.values(), key=lambda e: (_BOUND_ORDER[e.bound.value], e.key))
        items = [_entry_read(entry, used.get(entry.key, 0)) for entry in entries]
        return CatalogueResponse(items=items, total=len(items))
