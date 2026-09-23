"""The rules about a lens — creating, naming, promoting, deleting.

One record, two kinds ([GV1](docs/for-developers/modules/govern/spec.md)), and
one ladder where each rung is a single edit
([GV3](docs/for-developers/modules/govern/spec.md)):

    unnamed lens --name it--> world --kind--> guardrail

Naming is the write that publishes; promotion is a field change, never a
re-authoring. Both are ordinary audited writes, so *who loosened what, when, and
what it was before* is answerable from ``core/events`` like everything else
([GR7](docs/for-developers/modules/govern/features/guardrails.md)).
"""

from __future__ import annotations

import re
import unicodedata

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import GOVERNED_LAYERS, Layer
from invana.apps.govern.catalogue import Catalogue
from invana.apps.govern.models import Lens, LensKind
from invana.apps.govern.querysets import LensQuerySet
from invana.apps.govern.rules import Closure, Effective, Rule, RuleError, compose, validate_cast, validate_rule
from invana.apps.govern.schemas import LensCreate, LensUpdate, RuleIn
from invana.apps.govern.validate import Validation, validate_draft
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event

_SLUG_STRIP = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    """``EU · H1 2026`` → ``eu-h1-2026``.

    Derived once, at the first naming, and then frozen: a rename changes the
    display text alone, because only the *first* naming publishes
    ([WO1](docs/for-developers/modules/govern/features/worlds.md)) and a slug
    that moved would break every schedule that pinned one
    ([GV19](docs/for-developers/modules/govern/spec.md)).
    """
    folded = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = _SLUG_STRIP.sub("-", folded.lower()).strip("-")
    if not slug:
        raise ValidationError("A world's name needs at least one letter or digit.")
    return slug[:128]


def to_rules(rules: list[RuleIn] | list[dict]) -> list[Rule]:
    """Wire shapes → the grammar's own objects, refusing anything malformed."""
    out: list[Rule] = []
    for raw in rules:
        payload = raw if isinstance(raw, dict) else raw.model_dump()
        try:
            rule = Rule.from_dict(payload)
            validate_rule(rule)
        except RuleError as exc:
            raise ValidationError(str(exc)) from None
        out.append(rule)
    return out


def to_effective(lens: Lens) -> Effective:
    """One stored lens as a thing that can decide about an address.

    Its closure is built here, from **its own** rules, so that composing it with
    a guardrail cannot satisfy its allow-list with somebody else's broader allow
    ([GV23](docs/for-developers/modules/govern/spec.md)).
    """
    rules = [Rule.from_dict(raw) for raw in (lens.rules or [])]
    closed = {Layer(value) for value in (lens.closed_layers or [])}
    return Effective(
        rules=rules,
        cast=dict(lens.cast or {}),
        closed_layers=closed,
        closures=(
            [
                Closure(
                    layers=frozenset(closed),
                    allows=tuple(rule.match for rule in rules if rule.allow),
                    # Frozen with the rest, so a refusal names what this
                    # world was called when it refused ([GR15]).
                    name=lens.display_name,
                )
            ]
            if closed
            else []
        ),
        as_of=lens.as_of.isoformat() if lens.as_of else None,
        contributors=[
            {
                "id": lens.id,
                "kind": lens.kind,
                "key": lens.key,
                # Frozen with the rest, so a rename never rewrites a past run.
                "name": lens.display_name,
                "version": lens.version,
            }
        ],
    )


class LensManager:
    lenses_qs = LensQuerySet()

    # ── reading ──────────────────────────────────────────────────────────────

    async def list_for_graph(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        kind: str | None = None,
        include_unnamed: bool = False,
    ) -> list[Lens]:
        return await self.lenses_qs.list_for_graph(session, graph_id, kind=kind, include_unnamed=include_unnamed)

    async def get(self, session: AsyncSession, *, lens_id: str, graph_id: str) -> Lens:
        lens = await self.lenses_qs.get(session, lens_id)
        if lens is None or lens.graph_id != graph_id:
            # A scoping refusal reads as absent: the caller must not learn that
            # an id exists in a Graph they cannot see.
            raise NotFoundError("Lens not found.")
        return lens

    async def effective_guardrails(
        self, session: AsyncSession, *, graph_id: str, agent_id: str | None = None
    ) -> Effective:
        """Every guardrail in force — the Graph's, plus the agent's if it has one.

        Bounds nest, and an agent's guardrail **narrows** the Graph's; it can
        never widen it, which is checked when it is saved rather than composed
        away here.
        """
        pinned = await self.lenses_qs.guardrails_for_graph(session, graph_id)
        if agent_id:
            pinned += await self.lenses_qs.guardrails_for_agent(session, graph_id, agent_id)

        return compose([to_effective(lens) for lens in pinned]) if pinned else Effective()

    # ── writing ──────────────────────────────────────────────────────────────

    async def create(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        payload: LensCreate,
        actor_id: str,
        catalogue: Catalogue,
        may_edit_guardrails: bool = False,
    ) -> Lens:
        rules = to_rules(payload.rules)
        closed = self._closed_layers(payload.closed_layers)
        self._check_cast(payload.cast)

        if payload.kind is LensKind.guardrail:
            self._require_guardrail_permission(may_edit_guardrails)
            if not payload.name:
                raise ValidationError("A guardrail is always named — it is what an auditor is handed.")
            if not payload.scope:
                raise ValidationError("A guardrail is pinned on the Graph or on an agent.")
        elif payload.scope:
            raise ValidationError("Only a guardrail has a scope; a world narrows wherever it is picked.")

        guardrails = await self.effective_guardrails(session, graph_id=graph_id)
        if payload.kind is LensKind.world:
            self._enforce(
                validate_draft(
                    rules=rules,
                    cast=payload.cast,
                    closed_layers=closed,
                    guardrails=guardrails,
                    catalogue=catalogue,
                )
            )

        key, name = (None, None)
        if payload.name:
            key, name = await self._claim_name(session, graph_id, payload.name)

        lens = Lens(
            graph_id=graph_id,
            kind=payload.kind.value,
            key=key,
            name=name,
            scope=payload.scope,
            rules=[rule.as_dict() for rule in rules],
            cast=dict(payload.cast),
            closed_layers=sorted(layer.value for layer in closed),
            as_of=payload.as_of,
            created_in_run_id=payload.created_in_run_id,
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
            details={"kind": lens.kind, "key": lens.key, "rules": len(lens.rules)},
        )
        return lens

    async def update(
        self,
        session: AsyncSession,
        *,
        lens: Lens,
        payload: LensUpdate,
        actor_id: str,
        catalogue: Catalogue,
        may_edit_guardrails: bool = False,
    ) -> Lens:
        if lens.kind == LensKind.guardrail.value:
            self._require_guardrail_permission(may_edit_guardrails)

        before = {"rules": list(lens.rules or []), "cast": dict(lens.cast or {}), "key": lens.key}
        published = False

        if payload.rules is not None:
            rules = to_rules(payload.rules)
            lens.rules = [rule.as_dict() for rule in rules]
        else:
            rules = [Rule.from_dict(raw) for raw in (lens.rules or [])]

        if payload.cast is not None:
            self._check_cast(payload.cast)
            lens.cast = dict(payload.cast)
        if payload.closed_layers is not None:
            lens.closed_layers = sorted(layer.value for layer in self._closed_layers(payload.closed_layers))
        if payload.as_of is not None:
            lens.as_of = payload.as_of

        if payload.name is not None and payload.name != lens.name:
            if lens.key is None:
                # The first naming is the publish. Every later one is a rename,
                # and a rename is just a rename.
                lens.key, lens.name = await self._claim_name(session, lens.graph_id, payload.name)
                published = True
            else:
                lens.name = payload.name.strip()

        if lens.kind == LensKind.world.value:
            guardrails = await self.effective_guardrails(session, graph_id=lens.graph_id)
            self._enforce(
                validate_draft(
                    rules=rules,
                    cast=dict(lens.cast or {}),
                    closed_layers={Layer(v) for v in (lens.closed_layers or [])},
                    guardrails=guardrails,
                    catalogue=catalogue,
                )
            )

        lens.version += 1
        await session.flush()

        await emit_event(
            session,
            action=actions.LENS_NAME if published else actions.LENS_UPDATE,
            target_kind=actions.TARGET_LENS,
            target_id=lens.id,
            graph_id=lens.graph_id,
            actor_id=actor_id,
            details={
                "before": before,
                "after": {"rules": list(lens.rules or []), "cast": dict(lens.cast or {}), "key": lens.key},
            },
        )
        return lens

    async def promote(
        self,
        session: AsyncSession,
        *,
        lens: Lens,
        scope: str,
        actor_id: str,
        may_edit_guardrails: bool,
    ) -> Lens:
        """A world becomes a guardrail. **One field**, and no re-authoring.

        It leaves the Worlds list and appears under Guardrails; every world now
        narrows within it, and none of them is touched.
        """
        self._require_guardrail_permission(may_edit_guardrails)
        if lens.kind == LensKind.guardrail.value:
            raise ConflictError("This is already a guardrail.")
        if not lens.is_named:
            raise ValidationError("Name it first — a guardrail is always named.")

        lens.kind = LensKind.guardrail.value
        lens.scope = scope
        lens.version += 1
        await session.flush()

        await emit_event(
            session,
            action=actions.LENS_PROMOTE,
            target_kind=actions.TARGET_LENS,
            target_id=lens.id,
            graph_id=lens.graph_id,
            actor_id=actor_id,
            details={"scope": scope, "key": lens.key},
        )
        return lens

    async def duplicate(self, session: AsyncSession, *, lens: Lens, actor_id: str) -> Lens:
        """A copy, unnamed — so it starts private and naming it is a decision."""
        copy = Lens(
            graph_id=lens.graph_id,
            kind=LensKind.world.value,
            key=None,
            name=None,
            scope=None,
            rules=list(lens.rules or []),
            cast=dict(lens.cast or {}),
            closed_layers=list(lens.closed_layers or []),
            as_of=lens.as_of,
            created_by_id=actor_id,
        )
        await self.lenses_qs.add(session, copy)
        await emit_event(
            session,
            action=actions.LENS_CREATE,
            target_kind=actions.TARGET_LENS,
            target_id=copy.id,
            graph_id=lens.graph_id,
            actor_id=actor_id,
            details={"duplicated_from": lens.id},
        )
        return copy

    async def delete(
        self,
        session: AsyncSession,
        *,
        lens: Lens,
        actor_id: str,
        held_by: list[str],
        may_edit_guardrails: bool = False,
    ) -> None:
        """Refused while anything carries it, **naming what does**.

        ``held_by`` is the evidence — agent and schedule names — gathered by the
        edge, because those rows live above this band. A cron firing into a
        missing lens would silently fall back to the widest, which is the
        opposite of what the lens was for
        ([WO6](docs/for-developers/modules/govern/features/worlds.md)).
        """
        if lens.kind == LensKind.guardrail.value:
            self._require_guardrail_permission(may_edit_guardrails)
        if held_by:
            raise ConflictError(
                f"{lens.display_name} is still carried by {', '.join(sorted(held_by))}. "
                "Point them somewhere else first."
            )

        await self.lenses_qs.delete(session, lens)
        await emit_event(
            session,
            action=actions.LENS_DELETE,
            target_kind=actions.TARGET_LENS,
            target_id=lens.id,
            graph_id=lens.graph_id,
            actor_id=actor_id,
            details={"key": lens.key, "kind": lens.kind},
        )

    # ── the small refusals ───────────────────────────────────────────────────

    def _closed_layers(self, values: list[str]) -> set[Layer]:
        out: set[Layer] = set()
        for value in values:
            try:
                layer = Layer(value)
            except ValueError:
                raise ValidationError(f"{value!r} is not a layer.") from None
            if layer not in GOVERNED_LAYERS:
                raise ValidationError("The agent layer is the spine, and the spine is not governed.")
            out.add(layer)
        return out

    def _check_cast(self, cast: dict[str, str | None]) -> None:
        try:
            validate_cast(cast)
        except RuleError as exc:
            raise ValidationError(str(exc)) from None

    def _require_guardrail_permission(self, may_edit: bool) -> None:
        if not may_edit:
            raise PermissionDeniedError(
                "Editing a guardrail is a permission on this Graph. You can read every rule in force."
            )

    async def _claim_name(self, session: AsyncSession, graph_id: str, name: str) -> tuple[str, str]:
        cleaned = name.strip()
        if not cleaned:
            raise ValidationError("Name it to add it to Worlds.")
        key = slugify(cleaned)
        if await self.lenses_qs.get_by_key(session, graph_id, key) is not None:
            raise ConflictError(f"A world called {cleaned!r} already exists in this Graph.")
        return key, cleaned

    def _enforce(self, validation: Validation) -> None:
        if validation.ok:
            return
        # The whole list, not the first one: a person fixing a draft should see
        # every bound it crosses rather than discovering them one save at a time.
        raise ValidationError(
            {
                "error": "lens_refused",
                "refusals": [
                    {"code": r.code, "rule": r.rule, "message": r.message, "recourse": r.recourse}
                    for r in validation.refusals
                ],
            }
        )
