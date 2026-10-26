"""The rules about a Graph's guardrails — one property rule each.

*When a run touches* ``Deal.price`` · *it may* read it, read it in counts only or
never read it · *and the result* may leave or stays in the Graph. This manager
is the only writer of a Graph-scoped guardrail: every save validates the rule,
regenerates its name and recompiles its ``rules`` (see
:mod:`invana.apps.govern.guardrail`), so the list, the inspector and what the
connector enforces cannot disagree.

The refusals a save makes:

=================================  ===========================================
Read with May leave                422 — the rule narrows nothing
a second rule on one target        409 — naming the guardrail that holds it
a type or property nothing         422 — naming the type or the property
publishes
``T.*`` or ``*.*`` not Read        422 — a wildcard property only keeps the
                                   result in the Graph
no modeller role                   403 — every member reads, a modeller edits
=================================  ===========================================

Reads count what the list shows — ``types`` (published types carrying the
property) and ``refused_7d`` (requests it filed this week) — so Studio formats a
number and never derives one. Impact is counted before the write: the worlds in
which the property is read or may leave today, and the schedules that run in
them or in no world.

Usage::

    guardrails = GuardrailManager()
    lens = await guardrails.create(session, graph_id=g, payload=GuardrailIn(target="Deal.price",
                                   access="counts", leaves=False), actor_id=u, may_edit=True)
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import Layer
from invana.apps.govern.catalogue import Catalogue, CatalogueResolver, PublishedType
from invana.apps.govern.guardrail import (
    Target,
    TargetError,
    check_rule,
    compile_rules,
    generated_name,
    key_for,
    parse_target,
    sentence,
)
from invana.apps.govern.managers.lens import to_effective
from invana.apps.govern.models import GRAPH_SCOPE, GuardrailAccess, Lens, LensKind
from invana.apps.govern.query_lens import for_type
from invana.apps.govern.querysets import LensQuerySet, RequestQuerySet
from invana.apps.govern.rules import Decision, Effective, EgressClass, compose
from invana.apps.govern.schemas import (
    AppliesToRead,
    GuardrailDetail,
    GuardrailImpactRead,
    GuardrailIn,
    GuardrailPage,
    GuardrailRead,
    GuardrailRefusalRead,
    GuardrailTargetRead,
    GuardrailUpdate,
    HistoryRead,
    Ref,
)
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.querysets.event import EventQuerySet
from invana.core.events.services import emit_event

#: How many refusals the inspector lists; ``refusals_total`` counts the rest.
REFUSALS_SHOWN = 20

_HISTORY_ACTIONS = frozenset({actions.LENS_CREATE, actions.LENS_UPDATE, actions.LENS_DELETE})


@dataclass(frozen=True, slots=True)
class ScheduleWorlds:
    """One schedule, and the worlds its runs were asked in — ``None`` is no world."""

    id: str
    name: str
    worlds: frozenset[str | None]


def _reads(effective: Effective, published: Sequence[PublishedType], target: Target, access: GuardrailAccess) -> bool:
    """Whether a run under ``effective`` returns a value of the target today."""
    for ptype in published:
        verdict = effective.decide(ptype.address)
        if verdict.decision is not Decision.allowed:
            continue
        excluded = for_type(verdict.properties_excluded, ptype.type_name)
        counts_only = for_type(verdict.properties_counts_only, ptype.type_name)
        for prop in ptype.properties:
            if not target.covers(ptype.type_name, prop) or prop in excluded:
                continue
            if access is GuardrailAccess.never or prop not in counts_only:
                return True
    return False


def _leaves(effective: Effective, catalogue: Catalogue) -> bool:
    """Whether a property value may cross to any model or third party today."""
    for participant in (*catalogue.by_layer(Layer.llm), *catalogue.by_layer(Layer.third_party)):
        verdict = effective.decide(participant.address)
        if verdict.decision is not Decision.allowed:
            continue
        if not verdict.egress_stated or {EgressClass.property_values.value, EgressClass.everything.value} & set(
            verdict.may_send
        ):
            return True
    return False


def _plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else (many or one + 's')}"


class GuardrailManager:
    lenses_qs = LensQuerySet()
    requests_qs = RequestQuerySet()
    events_qs = EventQuerySet()
    catalogue = CatalogueResolver()

    # ── reading ──────────────────────────────────────────────────────────────

    async def get(self, session: AsyncSession, *, graph_id: str, guardrail_id: str) -> Lens:
        lens = await self.lenses_qs.get(session, guardrail_id)
        if lens is None or lens.graph_id != graph_id or not lens.is_graph_guardrail:
            raise NotFoundError("Guardrail not found.")
        return lens

    async def page(self, session: AsyncSession, *, graph_id: str, may_edit: bool) -> GuardrailPage:
        """Every Graph guardrail with its counts, and whether the reader may edit them."""
        rows = await self.lenses_qs.guardrails_for_graph(session, graph_id)
        items = await self.reads(session, graph_id=graph_id, rows=rows)
        return GuardrailPage(items=items, total=len(items), may_edit=may_edit)

    async def reads(self, session: AsyncSession, *, graph_id: str, rows: list[Lens]) -> list[GuardrailRead]:
        published = await self.catalogue.published_types(session, graph_id=graph_id)
        refused = await self.requests_qs.refused_since(
            session, guardrail_ids=[r.id for r in rows], since=datetime.now(UTC) - timedelta(days=7)
        )
        worlds = await self.requests_qs.lens_names(session, {w for r in rows for w in (r.allowed_in or [])})
        out = []
        for row in rows:
            target = parse_target(row.target)
            access = GuardrailAccess(row.access)
            out.append(
                GuardrailRead(
                    id=row.id,
                    name=row.display_name,
                    key=row.key,
                    target=row.target,
                    access=row.access,
                    leaves=bool(row.leaves),
                    allowed_in=[Ref(id=w, name=worlds.get(w)) for w in (row.allowed_in or []) if w in worlds],
                    types=len({p.type_name for p in published if self._carries(p, target)}),
                    refused_7d=refused.get(row.id, 0),
                    sentence=sentence(target, access, bool(row.leaves)),
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                )
            )
        return out

    async def detail(self, session: AsyncSession, *, guardrail: Lens, agent_names: dict[str, str]) -> GuardrailDetail:
        """The inspector: where it applies, what it refused, and its history."""
        (read,) = await self.reads(session, graph_id=guardrail.graph_id, rows=[guardrail])
        target = parse_target(guardrail.target)
        published = await self.catalogue.published_types(session, graph_id=guardrail.graph_id)
        applies = sorted(
            {
                (p.model, p.type_name, prop)
                for p in published
                for prop in (
                    ("*",)
                    if target.any_property
                    else (prop for prop in p.properties if target.covers(p.type_name, prop))
                )
                if self._carries(p, target)
            }
        )
        requests, total = await self.requests_qs.for_guardrail(session, guardrail_id=guardrail.id, limit=REFUSALS_SHOWN)
        people = await self.requests_qs.user_names(session, {r.asked_by_id for r in requests if r.asked_by_id})
        history = await self.events_qs.of_action(
            session, graph_id=guardrail.graph_id, actions=_HISTORY_ACTIONS, target_id=guardrail.id
        )
        return GuardrailDetail(
            **read.model_dump(),
            applies_to=[AppliesToRead(model=m, type=t, property=p) for m, t, p in applies],
            refusals=[
                GuardrailRefusalRead(
                    request_id=r.id,
                    who=people.get(r.asked_by_id) if r.asked_by_id else agent_names.get(r.agent_id or ""),
                    where=r.source,
                    at=r.last_asked_at,
                )
                for r in requests
            ],
            refusals_total=total,
            history=[
                HistoryRead(
                    action=event.action,
                    actor=(" ".join(p for p in (user.first_name, user.last_name) if p) or user.username)
                    if user
                    else None,
                    at=event.created_at,
                    details=dict(event.details or {}),
                )
                for event, user in history
            ],
        )

    async def targets(self, session: AsyncSession, *, graph_id: str) -> list[GuardrailTargetRead]:
        """Every ``Type.property`` the picker offers, from published versions."""
        published = await self.catalogue.published_types(session, graph_id=graph_id)
        seen: set[tuple[str, str]] = set()
        out = []
        for ptype in published:
            for prop in ptype.properties:
                if (ptype.type_name, prop) in seen:
                    continue
                seen.add((ptype.type_name, prop))
                out.append(
                    GuardrailTargetRead(
                        target=f"{ptype.type_name}.{prop}", model=ptype.model, type=ptype.type_name, property=prop
                    )
                )
        return sorted(out, key=lambda t: t.target)

    async def impact(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        payload: GuardrailIn,
        schedules: Iterable[ScheduleWorlds] = (),
    ) -> GuardrailImpactRead:
        """Who reads the target today and would not afterwards — counted before the write.

        A world is changed when, under the guardrails in force without this
        rule, a run asked in it returns the property's value (for *never* and
        *counts*) or lets a value cross to a model (for *stays in the Graph*).
        The guardrails alone are the *no world* case, which is where a schedule
        whose runs pick no world sits.
        """
        target, access = self._rule(payload.target, payload.access, payload.leaves)
        published = await self.catalogue.published_types(session, graph_id=graph_id)
        catalogue = await self.catalogue.resolve(session, graph_id=graph_id)
        others = [g for g in await self.lenses_qs.guardrails_for_graph(session, graph_id) if g.target != target.text]

        def changes(world: Lens | None) -> bool:
            contributors = [to_effective(g) for g in others if not (world and world.id in (g.allowed_in or []))]
            if world is not None:
                contributors.append(to_effective(world))
            effective = compose(contributors) if contributors else Effective()
            if access is not GuardrailAccess.read and _reads(effective, published, target, access):
                return True
            return not payload.leaves and _leaves(effective, catalogue)

        worlds = [w for w in await self.lenses_qs.worlds_for_graph(session, graph_id) if changes(w)]
        changed: set[str | None] = {w.id for w in worlds}
        if changes(None):
            changed.add(None)
        hit = [s for s in schedules if s.worlds & changed]

        if not worlds and not hit:
            text = f"Saving this changes no world and no schedule — nothing reads {target.text} today."
        else:
            text = (
                f"Saving this changes {_plural(len(worlds), 'world')} and {_plural(len(hit), 'schedule')}"
                f" that read {target.text} today."
            )
        return GuardrailImpactRead(
            worlds=[Ref(id=w.id, name=w.display_name) for w in worlds],
            schedules=[Ref(id=s.id, name=s.name) for s in hit],
            sentence=text,
        )

    # ── writing ──────────────────────────────────────────────────────────────

    async def create(
        self, session: AsyncSession, *, graph_id: str, payload: GuardrailIn, actor_id: str, may_edit: bool
    ) -> Lens:
        self._require(may_edit)
        target, access = self._rule(payload.target, payload.access, payload.leaves)
        await self._check_published(session, graph_id=graph_id, target=target)

        held = await self.lenses_qs.graph_guardrail_for_target(session, graph_id, target.text)
        if held is not None:
            raise ConflictError(f"{target.text} already has a rule — '{held.display_name}'. Edit that one instead.")
        key = key_for(target)
        if await self.lenses_qs.get_by_key(session, graph_id, key) is not None:
            raise ConflictError(f"The key {key!r} is already taken in this Graph.")

        lens = Lens(
            graph_id=graph_id,
            kind=LensKind.guardrail.value,
            scope=GRAPH_SCOPE,
            key=key,
            name=generated_name(target, access, payload.leaves),
            target=target.text,
            access=access.value,
            leaves=payload.leaves,
            allowed_in=[],
            rules=compile_rules(target, access, payload.leaves),
            cast={},
            closed_layers=[],
            created_by_id=actor_id,
        )
        await self.lenses_qs.add(session, lens)
        await emit_event(
            session,
            action=actions.LENS_CREATE,
            target_kind=actions.TARGET_LENS,
            target_id=lens.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"kind": lens.kind, "key": lens.key, **self._rule_of(lens)},
        )
        return lens

    async def update(
        self, session: AsyncSession, *, guardrail: Lens, payload: GuardrailUpdate, actor_id: str, may_edit: bool
    ) -> Lens:
        """Change what a run may do, whether the result leaves, or where it is allowed.

        The target is the guardrail's identity and never moves; a different
        property is a different rule.
        """
        self._require(may_edit)
        before = self._rule_of(guardrail)
        access = payload.access or GuardrailAccess(guardrail.access)
        leaves = guardrail.leaves if payload.leaves is None else payload.leaves
        target, access = self._rule(guardrail.target, access, leaves)

        if payload.allowed_in is not None:
            guardrail.allowed_in = await self._worlds(session, graph_id=guardrail.graph_id, ids=payload.allowed_in)
        guardrail.access = access.value
        guardrail.leaves = leaves
        guardrail.name = generated_name(target, access, leaves)
        guardrail.rules = compile_rules(target, access, leaves)
        guardrail.version += 1
        await session.flush()

        await emit_event(
            session,
            action=actions.LENS_UPDATE,
            target_kind=actions.TARGET_LENS,
            target_id=guardrail.id,
            graph_id=guardrail.graph_id,
            actor_id=actor_id,
            details={"before": before, "after": self._rule_of(guardrail)},
        )
        return guardrail

    async def delete(self, session: AsyncSession, *, guardrail: Lens, actor_id: str, may_edit: bool) -> None:
        self._require(may_edit)
        details = {"key": guardrail.key, "kind": guardrail.kind, **self._rule_of(guardrail)}
        await self.lenses_qs.delete(session, guardrail)
        await emit_event(
            session,
            action=actions.LENS_DELETE,
            target_kind=actions.TARGET_LENS,
            target_id=guardrail.id,
            graph_id=guardrail.graph_id,
            actor_id=actor_id,
            details=details,
        )

    # ── the refusals ─────────────────────────────────────────────────────────

    def _require(self, may_edit: bool) -> None:
        if not may_edit:
            raise PermissionDeniedError(
                "Editing a guardrail needs the modeller role on this Graph. You can read every rule in force."
            )

    def _rule(self, text: str, access: GuardrailAccess | str, leaves: bool) -> tuple[Target, GuardrailAccess]:
        try:
            target = parse_target(text)
            access = GuardrailAccess(access)
            check_rule(target, access, leaves)
        except (TargetError, ValueError) as exc:
            raise ValidationError(str(exc)) from None
        return target, access

    async def _check_published(self, session: AsyncSession, *, graph_id: str, target: Target) -> None:
        """A target names a type and a property some published version declares."""
        published = await self.catalogue.published_types(session, graph_id=graph_id)
        typed = [p for p in published if target.any_type or p.type_name == target.type_name]
        if not typed:
            raise ValidationError(f"No published model declares the type {target.type_name!r}.")
        if not target.any_property and not any(target.property_name in p.properties for p in typed):
            where = "any type" if target.any_type else target.type_name
            raise ValidationError(f"{where} declares no property {target.property_name!r} in a published model.")

    async def _worlds(self, session: AsyncSession, *, graph_id: str, ids: list[str]) -> list[str]:
        """The named worlds of this Graph, in the order given; any other id is refused by name."""
        out: list[str] = []
        for world_id in dict.fromkeys(ids):
            world = await self.lenses_qs.get(session, world_id)
            if world is None or world.graph_id != graph_id or world.kind != LensKind.world.value or not world.is_named:
                raise ValidationError(f"{world_id!r} is not a world in this Graph.")
            out.append(world.id)
        return out

    @staticmethod
    def _carries(ptype: PublishedType, target: Target) -> bool:
        if not (target.any_type or ptype.type_name == target.type_name):
            return False
        return target.any_property or target.property_name in ptype.properties

    @staticmethod
    def _rule_of(lens: Lens) -> dict:
        return {
            "target": lens.target,
            "access": lens.access,
            "leaves": lens.leaves,
            "allowed_in": list(lens.allowed_in or []),
        }
