"""The lens view — a world, or the guardrails alone, read on the model.

The Worlds and Guardrails pages draw the schema with *hidden*, *sliced* and
*guarded* marked on it. Every mark is decided here, by the same evaluation a
run is dispatched under — :meth:`Effective.decide` on each published version's
address, and :func:`~invana.apps.govern.query_lens.for_type` for the property
entries per type — so the canvas never re-reads a rule and cannot disagree with
what the connector is handed.

Without a world it is the Graph's guardrails alone: no type hidden, the guarded
properties marked. With one, the guardrails allowed in that world are left out,
exactly as a run asked there leaves them out.

Usage::

    view = await LensViewManager().view(session, graph_id=g, world=world_or_none, used_by=[...])
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import Layer
from invana.apps.govern.catalogue import CatalogueResolver
from invana.apps.govern.guardrail import WILDCARD, parse_target
from invana.apps.govern.managers.lens import to_effective
from invana.apps.govern.models import Lens
from invana.apps.govern.query_lens import for_type
from invana.apps.govern.querysets import LensQuerySet
from invana.apps.govern.rules import Decision, Effective, EgressClass, compose
from invana.apps.govern.schemas import (
    AnswersGoRead,
    GuardedPropertyRead,
    LensView,
    LensViewModel,
    LensViewType,
    LensViewWindow,
    Ref,
    UsedByRead,
)

#: What may leave when nothing bounds a crossing — every class but the local one.
_UNBOUNDED = [c.value for c in EgressClass if c is not EgressClass.everything]


def _window(select: dict[str, Any]) -> LensViewWindow:
    """The slice as a person reads it."""
    time = select.get("time") or None
    geo = select.get("geo") or None
    return LensViewWindow(
        time=f"{time.get('from') or '…'} → {time.get('to') or '…'}" if isinstance(time, dict) else None,
        geo=f"in {', '.join(str(v) for v in geo.get('in') or [])}" if isinstance(geo, dict) else None,
    )


class LensViewManager:
    lenses_qs = LensQuerySet()
    catalogue = CatalogueResolver()

    async def view(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        world: Lens | None = None,
        used_by: list[UsedByRead] | None = None,
    ) -> LensView:
        guardrails = [
            g
            for g in await self.lenses_qs.guardrails_for_graph(session, graph_id)
            if not (world is not None and world.id in (g.allowed_in or []))
        ]
        contributors = [to_effective(g) for g in guardrails]
        if world is not None:
            contributors.append(to_effective(world))
        effective = compose(contributors) if contributors else Effective()

        published = await self.catalogue.published_types(session, graph_id=graph_id)
        rules = [(g, parse_target(g.target)) for g in guardrails if g.target]

        models: dict[tuple[str, str | None], LensViewModel] = {}
        types: list[LensViewType] = []
        select: dict[str, Any] = {}
        for ptype in published:
            verdict = effective.decide(ptype.address)
            hidden = verdict.decision is not Decision.allowed
            sliced = not hidden and bool(verdict.select)
            if sliced and not select:
                select = dict(verdict.select)
            models.setdefault(
                (ptype.model, ptype.version),
                LensViewModel(
                    name=ptype.model, version=ptype.version, seen="hidden" if hidden else "sliced" if sliced else "all"
                ),
            )
            excluded = for_type(verdict.properties_excluded, ptype.type_name) & frozenset(ptype.properties)
            guarded = []
            for guardrail, target in rules:
                if not (target.any_type or target.type_name == ptype.type_name):
                    continue
                covered = (
                    [WILDCARD]
                    if target.any_property
                    else [p for p in ptype.properties if target.covers(ptype.type_name, p)]
                )
                guarded.extend(
                    GuardedPropertyRead(
                        property=prop,
                        guardrail_id=guardrail.id,
                        guardrail=guardrail.display_name,
                        access=guardrail.access,
                        leaves=bool(guardrail.leaves),
                    )
                    for prop in covered
                )
            types.append(
                LensViewType(
                    model=ptype.model,
                    type=ptype.type_name,
                    hidden=hidden,
                    sliced=sliced,
                    excluded=sorted(excluded),
                    guarded=guarded,
                )
            )

        catalogue = await self.catalogue.resolve(session, graph_id=graph_id)
        answers_go = []
        for participant in (*catalogue.by_layer(Layer.llm), *catalogue.by_layer(Layer.third_party)):
            verdict = effective.decide(participant.address)
            if verdict.decision is not Decision.allowed:
                may_send = None
            else:
                may_send = list(verdict.may_send) if verdict.egress_stated else list(_UNBOUNDED)
            answers_go.append(AnswersGoRead(address=participant.address, may_send=may_send))

        return LensView(
            world=Ref(id=world.id, name=world.display_name) if world is not None else None,
            models=list(models.values()),
            types=types,
            hidden_types=sorted({t.type for t in types if t.hidden}),
            guarded=len({(t.type, g.property) for t in types for g in t.guarded if g.property != WILDCARD}),
            window=_window(select),
            thinks_with=dict(world.cast or {}) if world is not None else {},
            answers_go=answers_go,
            used_by=list(used_by or []),
        )
