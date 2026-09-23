"""HTTP views for Govern.

Parse, call one manager, serialise (migration-plan §4.1). Two of these compose
more than one manager, and deliberately: a lens's *usage* lives in the runtime
and *who carries it* lives in the agents app, both of which sit above
``apps/govern`` and neither of which it may import. The edge is the band that
can see all three, so it gathers the evidence and hands it to the manager that
holds the rule about it.
"""

from __future__ import annotations

from fastapi import Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.govern.addressing import Layer
from invana.apps.govern.cast import resolve_all
from invana.apps.govern.catalogue import CatalogueResolver
from invana.apps.govern.impact import assess
from invana.apps.govern.managers import LensManager, TouchManager
from invana.apps.govern.managers.lens import to_effective, to_rules
from invana.apps.govern.models import Lens, LensKind
from invana.apps.govern.rules import Decision, Effective, compose, from_snapshot
from invana.apps.govern.schemas import (
    CastResolutionRead,
    CatalogueRead,
    CompareRead,
    CompareSideRead,
    ImpactRead,
    ImpactRequest,
    LensCreate,
    LensListResponse,
    LensPromote,
    LensRead,
    LensUpdate,
    LensUsageRead,
    ParticipantRead,
    RefusalRead,
    TouchesRead,
    TouchRead,
    ValidateRequest,
    ValidationRead,
    WarningRead,
    WorldImpactRead,
)
from invana.apps.govern.validate import validate_draft
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.errors import NotFoundError
from invana.runtime.querysets import TaskRunQuerySet
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

lenses = LensManager()
touches = TouchManager()
catalogue_resolver = CatalogueResolver()
agents_qs = AgentQuerySet()
task_runs_qs = TaskRunQuerySet()


def _read(
    lens: Lens,
    *,
    usage: LensUsageRead | None = None,
    cast_resolved: list[CastResolutionRead] | None = None,
) -> LensRead:
    return LensRead(
        id=lens.id,
        graph_id=lens.graph_id,
        kind=lens.kind,
        key=lens.key,
        name=lens.name,
        display_name=lens.display_name,
        scope=lens.scope,
        rules=list(lens.rules or []),
        cast=dict(lens.cast or {}),
        closed_layers=list(lens.closed_layers or []),
        as_of=lens.as_of,
        created_in_run_id=lens.created_in_run_id,
        version=lens.version,
        is_named=lens.is_named,
        created_at=lens.created_at,
        updated_at=lens.updated_at,
        usage=usage,
        cast_resolved=cast_resolved,
    )


# ── the two drawers ──────────────────────────────────────────────────────────


async def list_lenses(
    kind: LensKind | None = Query(default=None),
    include_unnamed: bool = Query(default=False),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LensListResponse:
    """The Worlds drawer, or the Guardrails one.

    A guardrail **never appears under ``kind=world``**
    ([GR1](docs/for-developers/modules/govern/features/guardrails.md)) — that is
    what the filter is for, and why it is not one list with a badge.
    """
    items = await lenses.list_for_graph(
        session,
        graph_id=graph.id,
        kind=kind.value if kind else None,
        include_unnamed=include_unnamed,
    )
    usage = await task_runs_qs.usage_for_lenses(session, [lens.id for lens in items])
    reads = [
        _read(
            lens,
            usage=LensUsageRead(runs=usage.get(lens.id, (0, None))[0], last_used_at=usage.get(lens.id, (0, None))[1]),
        )
        for lens in items
    ]
    return LensListResponse(
        items=reads,
        total=len(reads),
        may_edit_guardrails=member.can_edit_guardrails,
    )


async def get_lens(
    lens_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> LensRead:
    """One lens, and the cast it would actually get (R4).

    The cast is resolved **against the guardrails composed with it**, not
    against the lens alone: *innermost wins, then the resolved address is
    checked* ([GV6]) — and a role this lens casts to a model a guardrail denies
    has to read as denied here, naming the rule, rather than as a row that
    looks fine until a run refuses to open.
    """
    lens = await lenses.get(session, lens_id=lens_id, graph_id=graph.id)
    runs, last, actors = await task_runs_qs.lens_usage(session, lens.id)
    ceiling = await lenses.effective_guardrails(session, graph_id=graph.id)
    # A guardrail pinned on the Graph is already one of the contributors to the
    # ceiling, so composing it a second time would list it twice and decide
    # nothing differently. A world is read **inside** the ceiling.
    effective = ceiling if lens.kind == LensKind.guardrail.value else compose([ceiling, to_effective(lens)])
    return _read(
        lens,
        usage=LensUsageRead(runs=runs, last_used_at=last, actor_ids=actors),
        cast_resolved=[
            CastResolutionRead(
                role=r.role.value,
                address=r.address,
                allowed=r.allowed,
                rule_matched=r.rule_matched,
                source=r.source,
                refusal=r.refusal,
            )
            for r in resolve_all(effective)
        ],
    )


async def create_lens(
    payload: LensCreate,
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LensRead:
    lens = await lenses.create(
        session,
        graph_id=graph.id,
        payload=payload,
        actor_id=user.id,
        catalogue=await catalogue_resolver.resolve(session, graph_id=graph.id),
        may_edit_guardrails=member.can_edit_guardrails,
    )
    return _read(lens)


async def update_lens(
    payload: LensUpdate,
    lens_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LensRead:
    """Naming it here is the write that publishes it ([WO1])."""
    lens = await lenses.get(session, lens_id=lens_id, graph_id=graph.id)
    updated = await lenses.update(
        session,
        lens=lens,
        payload=payload,
        actor_id=user.id,
        catalogue=await catalogue_resolver.resolve(session, graph_id=graph.id),
        may_edit_guardrails=member.can_edit_guardrails,
    )
    return _read(updated)


async def promote_lens(
    payload: LensPromote,
    lens_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LensRead:
    lens = await lenses.get(session, lens_id=lens_id, graph_id=graph.id)
    promoted = await lenses.promote(
        session,
        lens=lens,
        scope=payload.scope,
        actor_id=user.id,
        may_edit_guardrails=member.can_edit_guardrails,
    )
    return _read(promoted)


async def duplicate_lens(
    lens_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LensRead:
    lens = await lenses.get(session, lens_id=lens_id, graph_id=graph.id)
    return _read(await lenses.duplicate(session, lens=lens, actor_id=user.id))


async def delete_lens(
    lens_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Refused while an agent carries it, naming the agents.

    The holders are gathered here because ``agents.lens_id`` belongs to a band
    Govern may not read back into; the refusal itself is the manager's.
    """
    lens = await lenses.get(session, lens_id=lens_id, graph_id=graph.id)
    await lenses.delete(
        session,
        lens=lens,
        actor_id=user.id,
        held_by=await agents_qs.names_using_lens(session, lens.id),
        may_edit_guardrails=member.can_edit_guardrails,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── authoring: what a save would be refused for, and what it would cost ──────


async def validate_lens(
    payload: ValidateRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ValidationRead:
    """Dry-run a draft against the guardrails it must live inside.

    The same check the save performs, offered before it — so the two refusals
    the design draws (*a world cannot widen a guardrail*, *only declared axes
    are selectable*) land while somebody is still looking at the form.
    """
    result = validate_draft(
        rules=to_rules(payload.rules),
        cast=payload.cast,
        closed_layers={Layer(value) for value in payload.closed_layers},
        guardrails=await lenses.effective_guardrails(session, graph_id=graph.id, agent_id=payload.agent_id),
        catalogue=await catalogue_resolver.resolve(session, graph_id=graph.id),
    )
    # Built field by field. `Refusal` and `Warning_` are `slots=True`
    # dataclasses, so they carry no `__dict__` at all and reading one raises —
    # which is what this route did on every call, refusal or not. The resolver
    # behind it has 45 tests; none of them went through the view.
    return ValidationRead(
        ok=result.ok,
        refusals=[
            RefusalRead(code=r.code, rule=r.rule, message=r.message, recourse=r.recourse) for r in result.refusals
        ],
        warnings=[WarningRead(code=w.code, rule=w.rule, message=w.message) for w in result.warnings],
    )


async def guardrail_impact(
    payload: ImpactRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ImpactRead:
    """*Saving this would change 2 of 4 worlds* — and what each one loses.

    Read **before** the write ([GR2]): a guardrail that silently invalidates six
    worlds is one whose effect nobody saw at the moment they took
    responsibility for it.
    """
    proposed = Effective(
        rules=to_rules(payload.rules),
        closed_layers={Layer(value) for value in payload.closed_layers},
    )
    worlds = await lenses.list_for_graph(session, graph_id=graph.id, kind=LensKind.world.value)
    result = assess(
        proposed=proposed,
        current=await lenses.effective_guardrails(session, graph_id=graph.id),
        worlds=[(world.id, world.display_name, to_effective(world)) for world in worlds],
        catalogue=await catalogue_resolver.resolve(session, graph_id=graph.id),
    )
    return ImpactRead(
        headline=result.headline,
        worlds=[
            WorldImpactRead(
                lens_id=world.lens_id,
                name=world.name,
                loses=list(world.loses),
                cast_denied=list(world.cast_denied),
                changes=world.changes,
                summary=world.summary,
            )
            for world in result.worlds
        ],
    )


async def list_participants(
    layer: Layer | None = Query(default=None),
    match: str | None = Query(default=None, max_length=512),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> CatalogueRead:
    """What this Graph can address — and with ``match``, what a rule would bite.

    The builder reads this as the pattern is typed
    ([GR9](docs/for-developers/modules/govern/features/guardrails.md)). A layer
    with nothing configured comes back empty *and says so* through
    ``layers_present``, so the form can tell *nothing is set up* from *nothing
    matched*.
    """
    catalogue = await catalogue_resolver.resolve(session, graph_id=graph.id)
    items = catalogue.matching(match) if match else catalogue.participants
    if layer is not None:
        items = tuple(p for p in items if p.layer is layer)
    return CatalogueRead(
        items=[
            ParticipantRead(
                address=p.address,
                layer=p.layer.value,
                sublayer=p.sublayer,
                name=p.name,
                label=p.label,
                axes=p.axes,
                properties=list(p.properties),
                note=p.note,
            )
            for p in items
        ],
        total=len(items),
        layers_present=[layer_.value for layer_ in catalogue.layers_present()],
        match=match,
    )


# ── what a run actually did ──────────────────────────────────────────────────


async def list_touches(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TouchesRead:
    """One run's ledger, in ``seq`` order, refusals struck in place.

    ``allowed`` comes from the lens the run **froze**, not from the lens as it
    stands now: a guardrail tightened since must not rewrite what a past answer
    was allowed to rest on ([GR3]).
    """
    run = await task_runs_qs.get(session, run_id)
    if run is None or run.graph_id != graph.id:
        raise NotFoundError("Run not found.")

    frozen = from_snapshot(run.lens_snapshot)
    catalogue = await catalogue_resolver.resolve(session, graph_id=graph.id)
    allowed = [p.address for p in catalogue.participants if frozen.decide(p.address).decision is Decision.allowed]

    items = await touches.for_run(session, run_id=run_id)
    readings = await touches.readings(session, run_id=run_id, allowed=allowed)
    return TouchesRead(
        run_id=run_id,
        items=[TouchRead(**touch.as_reading()) for touch in items],
        total=len(items),
        counts=await touches.counts(session, run_id=run_id),
        **readings,
    )


async def compare_runs(
    a: str = Query(..., max_length=36),
    b: str = Query(..., max_length=36),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> CompareRead:
    """Two runs that each happened for real, placed side by side.

    **Compare is two runs, not a diff engine** ([WO4]) — nothing here simulates
    anything or synthesises one answer from another. What B touched that A did
    not is the part a person cannot reconstruct by reading both.
    """
    sides = []
    for run_id in (a, b):
        run = await task_runs_qs.get(session, run_id)
        if run is None or run.graph_id != graph.id:
            raise NotFoundError("Run not found.")
        lens = None
        if run.lens_id:
            try:
                lens = await lenses.get(session, lens_id=run.lens_id, graph_id=graph.id)
            except NotFoundError:
                # The world was deleted since. The run still reads, because its
                # snapshot is what made the answer reconstructible, not the row.
                lens = None
        sides.append((run, lens))

    diff = await touches.compare(session, run_a=a, run_b=b)
    by_run = {
        run_id: sorted(addresses)
        for run_id, addresses in (await touches.touches_qs.addresses_for_runs(session, [a, b])).items()
    }

    return CompareRead(
        a=CompareSideRead(
            run_id=a,
            lens_id=sides[0][0].lens_id,
            lens_name=sides[0][1].display_name if sides[0][1] else None,
            touched=by_run.get(a, []),
            cost_usd=sides[0][0].cost_usd,
        ),
        b=CompareSideRead(
            run_id=b,
            lens_id=sides[1][0].lens_id,
            lens_name=sides[1][1].display_name if sides[1][1] else None,
            touched=by_run.get(b, []),
            cost_usd=sides[1][0].cost_usd,
        ),
        **diff,
    )
