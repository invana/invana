"""The half that bites — the check, the compilation, the cut and the ledger.

Everything else in this suite proves the grammar is right. These prove it
**happens**: that a frozen lens becomes a ``QueryLens`` the connector can
enforce, that egress cuts the parts of a prompt before there is a prompt, and
that a touch is written as the projection of a frame it carries the ``seq`` of
([GV28](docs/for-developers/modules/govern/spec.md)).

Real Postgres, no mocks.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.apps.govern.managers.touch import TouchManager
from invana.apps.govern.models import TouchDirection
from invana.apps.govern.query_lens import ModelBinding, build_query_lens, compile_lens, model_address
from invana.apps.govern.rules import Closure, Effective, Layer, Rule, compose, from_snapshot
from invana.apps.graphs.models import Graph
from invana.apps.llm.grounding import render_model_context
from invana.apps.modeller.models import (
    GraphModel,
    GraphVersion,
    NodeTypeDefinition,
    PropertyKeyDefinition,
    TypePropertyMapping,
)
from invana.apps.modeller.querysets.graph_version import GraphVersionQuerySet
from invana.runtime.governing import PROMPT_CLASSES, Governor
from invana.runtime.models import TaskRun
from invana.runtime.stream import Emitter

# ``asyncio_mode = auto`` — the async tests need no mark, and the sync ones
# here (the grammar and the cut are pure) must not carry one.

ADDRESS = "graph_data/model/Airways@1.0.0"


@pytest.fixture
async def version(session: AsyncSession, graph: Graph) -> GraphVersion:
    """One published version: two types, three properties, a declared time axis."""
    model = GraphModel(graph_id=graph.id, name="Airways", description="", package_id="airways")
    session.add(model)
    await session.flush()
    row = GraphVersion(
        model_id=model.id,
        version="1.0.0",
        status="active",
        axes={"time": {"property": "observed_at"}, "dims": ["carrier"]},
    )
    session.add(row)
    await session.flush()

    keys = {}
    for name in ("observed_at", "carrier", "revenue"):
        key = PropertyKeyDefinition(version_id=row.id, name=name, type="string")
        session.add(key)
        keys[name] = key
    await session.flush()

    for type_name, properties in (("Route", ("observed_at", "carrier", "revenue")), ("Airport", ("carrier",))):
        node = NodeTypeDefinition(version_id=row.id, name=type_name, description="")
        session.add(node)
        await session.flush()
        for name in properties:
            session.add(TypePropertyMapping(node_type_id=node.id, property_key_id=keys[name].id))
    await session.commit()
    # Re-read through the queryset the runtime reads it through, so the type
    # tree is eager-loaded exactly as a run's grounding version is.
    found = await GraphVersionQuerySet().get_version(session, row.id)
    assert found is not None
    return found


# ── the compilation ──────────────────────────────────────────────────────────


class TestWhatTheConnectorIsHanded:
    async def test_a_lens_that_narrows_nothing_compiles_to_nothing(self, version: GraphVersion) -> None:
        """**The default is the widest** (GV7), and the query runs byte-identical.

        An empty ``QueryLens`` is skipped by the compiler entirely, which is what
        keeps *nothing was narrowed* visible as two equal digests rather than as
        a rewrite nobody asked for.
        """
        lens = Effective(rules=[Rule(match=ADDRESS, allow=True)])

        compiled = build_query_lens(lens, version=version, verdict=lens.decide(ADDRESS))

        assert compiled.is_empty

    async def test_an_exclusion_and_a_slice_reach_the_types_that_carry_them(self, version: GraphVersion) -> None:
        """Two grains at once: the property is gone, the records are predicated.

        ``Airport`` carries neither ``revenue`` nor the time axis, so it is bound
        and left unnarrowed — a predicate on a property a type lacks would return
        nothing and read as an empty world.
        """
        lens = Effective(
            rules=[
                Rule(
                    match="graph_data/model/Airways@*",
                    allow=True,
                    properties={"exclude": ["revenue"]},
                    select={"time": {"from": "2026-01-01"}},
                )
            ]
        )

        compiled = build_query_lens(lens, version=version, verdict=lens.decide(ADDRESS))

        route = compiled.bound_for("Route")
        assert route is not None
        assert route.permitted == ("carrier", "observed_at")
        assert route.narrows_structure and route.narrows_records
        assert route.predicates is not None
        assert [c.property for c in route.predicates.conditions] == ["observed_at"]

        airport = compiled.bound_for("Airport")
        assert airport is not None
        assert not airport.narrows_structure and not airport.narrows_records

    async def test_a_closed_layer_allow_lists_the_types_it_named(self, version: GraphVersion) -> None:
        """Closing a layer is what picking models out of a list means (GV23)."""
        lens = Effective(
            rules=[Rule(match=ADDRESS, allow=True)],
            closed_layers={Layer.graph_data},
        )

        compiled = build_query_lens(lens, version=version, verdict=lens.decide(ADDRESS))

        assert compiled.allowed_types == frozenset({"Route", "Airport"})
        assert not compiled.allows_type("Invoice")

    async def test_a_slice_on_an_axis_the_model_never_declared_narrows_nothing(self, version: GraphVersion) -> None:
        """Refused at save (GV14); if one survives, it must not slice something else."""
        lens = Effective(
            rules=[Rule(match=ADDRESS, allow=True, select={"geo": {"in": ["IE"]}})],
        )

        compiled = build_query_lens(lens, version=version, verdict=lens.decide(ADDRESS))

        assert compiled.is_empty


class TestAnAllowListIsNotSatisfiedBySomebodyElsesAllow:
    """**Allow intersects** (GV6), and a closed layer is *that lens's* list (GV23).

    Found by running the real `admin/airways` rows rather than a fixture: a
    world named *Nothing leaves* closes `llm` and allow-lists one local model,
    and the Graph's own `llm/** allow` guardrail was admitting the hosted model
    straight through it. Composing every contributor into one flat rule list
    loses the *that lens's* half of GV23, and the loss fails **open**.
    """

    def test_a_broader_guardrail_does_not_punch_through_a_worlds_allow_list(self) -> None:
        guardrail = Effective(rules=[Rule(match="llm/**", allow=True)])
        world = to_effective_like(
            rules=[Rule(match="llm/ollama-local/*", allow=True)],
            closed={Layer.llm},
        )

        lens = compose([guardrail, world])

        assert lens.decide("llm/ollama-local/mistral").allowed
        refused = lens.decide("llm/anthropic-prod/claude-opus-5")
        assert not refused.allowed
        assert "the llm layer is closed" in (refused.why or "")
        # GR15 — no rule fired, so the world is what the refusal has to name.
        assert refused.rule_matched is None
        assert refused.narrowed_by == "Nothing leaves"

    def test_a_layer_nobody_closed_is_permitted_whole(self) -> None:
        """One absent from `closed_layers` is permitted whole (GV23 · GV7)."""
        lens = compose(
            [
                Effective(rules=[Rule(match="llm/**", allow=True)]),
                to_effective_like(
                    rules=[Rule(match="graph_data/model/Routes@*", allow=True)],
                    closed={Layer.graph_data},
                ),
            ]
        )

        assert lens.decide("llm/anthropic-prod/claude-opus-5").allowed
        assert not lens.decide("graph_data/model/Deals@1.0.0").allowed

    def test_a_frozen_snapshot_carries_whose_allow_list_it_was(self) -> None:
        """A run has to answer *whose list* months later, so it is written down."""
        lens = compose(
            [
                Effective(rules=[Rule(match="llm/**", allow=True)]),
                to_effective_like(rules=[Rule(match="llm/ollama-local/*", allow=True)], closed={Layer.llm}),
            ]
        )

        read_back = from_snapshot(lens.as_snapshot())

        assert not read_back.decide("llm/anthropic-prod/claude-opus-5").allowed
        assert read_back.decide("llm/ollama-local/mistral").allowed


def to_effective_like(*, rules: list[Rule], closed: set[Layer], name: str = "Nothing leaves") -> Effective:
    """One contributor, closing what it closes over its own rules — the shape
    `managers.lens.to_effective` builds from a stored row, name and all (GR15)."""
    return Effective(
        rules=rules,
        closed_layers=set(closed),
        closures=[Closure(layers=frozenset(closed), allows=tuple(r.match for r in rules if r.allow), name=name)],
    )


# ── the cut ──────────────────────────────────────────────────────────────────


class TestWhatMayAccompanyACall:
    def test_a_crossing_no_rule_reached_is_unbounded(self) -> None:
        """``[]`` with nothing stated is *nobody wrote a rule* (GV30), not *send nothing*."""
        verdict = Effective().decide("llm/anthropic-prod/claude-opus-5")

        assert verdict.allowed and verdict.egress_unbounded

    def test_a_rule_that_permits_nothing_cuts_everything(self) -> None:
        lens = Effective(rules=[Rule(match="llm/**", allow=True, egress={"may_send": []})])

        verdict = lens.decide("llm/anthropic-prod/claude-opus-5")

        assert verdict.allowed and not verdict.egress_unbounded and verdict.may_send == []

    def test_the_cut_names_both_halves_and_only_what_was_held(self) -> None:
        """*Nothing was cut* and *nothing was governed* are different runs."""
        lens = Effective(rules=[Rule(match="llm/**", allow=True, egress={"may_send": ["type_names", "the_question"]})])
        governor = Governor(effective=lens, run_id="r", graph_id="g", touches=TouchManager())

        egress = governor.egress_for(lens.decide("llm/anthropic-prod/claude-opus-5"), carrying=PROMPT_CLASSES)

        assert egress.classes == ("type_names", "the_question")
        assert egress.cut == ("property_names", "property_values")

    async def test_the_grounding_block_is_cut_to_the_classes_that_may_go(self, version: GraphVersion) -> None:
        """The cut is to the **part**, before the prompt exists (GV31)."""
        whole = render_model_context(version)
        labels_only = render_model_context(version, may_send=frozenset({"type_names"}))
        nothing = render_model_context(version, may_send=frozenset({"the_question"}))

        assert "revenue" in whole and "Route" in whole
        assert "Route" in labels_only and "revenue" not in labels_only
        assert "Route" not in nothing and "does not permit" in nothing


# ── the ledger ───────────────────────────────────────────────────────────────


class TestTheTouchIsAProjection:
    async def test_a_touch_carries_the_seq_of_the_frame_it_projects(
        self, session: AsyncSession, db_engine, graph: Graph
    ) -> None:
        """One frame, one row, one ``seq`` (GV20 · GV28)."""
        run = TaskRun(graph_id=graph.id, ask_kind="nl", body="how many routes?")
        session.add(run)
        await session.commit()

        governor = Governor.for_run(run)
        emitter = Emitter(async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False), run.id)
        await governor.record(
            session,
            emitter,
            address=ADDRESS,
            direction=TouchDirection.into,
            step_key="execute_query",
            verdict=governor.check(ADDRESS),
            volume={"rows": 128},
        )
        await session.commit()

        recorded = await TouchManager().for_run(session, run_id=run.id)
        assert len(recorded) == 1
        assert recorded[0].seq == 1
        assert recorded[0].layer == "graph_data" and recorded[0].participant == "Airways@1.0.0"
        assert recorded[0].volume == {"rows": 128}

    async def test_a_refusal_is_recorded_with_the_rule_that_decided_it(
        self, session: AsyncSession, db_engine, graph: Graph
    ) -> None:
        """A refusal names its rule (GR4) and is struck in place, never dropped."""
        run = TaskRun(
            graph_id=graph.id,
            ask_kind="nl",
            body="enrich these",
            lens_snapshot={"rules": [{"match": "third_party/**", "allow": False}]},
        )
        session.add(run)
        await session.commit()

        governor = Governor.for_run(run)
        address = "third_party/api/clearbit.com/v2/companies"
        verdict = governor.check(address)
        assert not verdict.allowed

        emitter = Emitter(async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False), run.id)
        await governor.record(session, emitter, address=address, direction=TouchDirection.refused, verdict=verdict)
        await session.commit()

        recorded = await TouchManager().for_run(session, run_id=run.id)
        assert [t.direction for t in recorded] == ["refused"]
        assert recorded[0].rule_matched == "third_party/**"
        assert recorded[0].why


def test_the_address_is_the_one_the_catalogue_lists() -> None:
    """A second spelling of an address would be a second participant (GV4)."""
    assert model_address(model_name="Airways", version_label="1.0.0") == ADDRESS
    assert model_address(model_name="Airways", version_label=None) == "graph_data/model/Airways"


# ── a rule names one model, the run is grounded on another ───────────────────


class TestAModelNamedByARuleBindsTheTypesItDeclares:
    """[GV33] — the half that made every four-model world answer *cannot answer*.

    A run is grounded on the introspected mirror, because it is the one model
    whose types cover what an arbitrary query can reach. A world names the
    **authored** models, so its rules match an address the run never engages:
    before this, `Deals@*` froze into the snapshot and narrowed nothing, and a
    world that closed `graph_data` refused every read.

    ``version`` here stands in for the mirror — the run's grounding — and the
    bindings for what the Graph publishes beside it.
    """

    DEALS = ModelBinding(
        address="graph_data/model/Deals@1.0.0",
        types=("Route",),
        axes={"time": {"property": "observed_at"}},
    )

    def test_a_rule_on_another_model_excludes_that_models_types(self, version: GraphVersion) -> None:
        """*Price-blind* — the exclusion reaches `Route` although the rule never
        names the version the run is grounded on."""
        lens = Effective(
            rules=[Rule(match="graph_data/model/Deals@*", allow=True, properties={"exclude": ["revenue"]})]
        )

        compiled = build_query_lens(lens, version=version, verdict=lens.decide(ADDRESS), bindings=[self.DEALS])

        route = compiled.bound_for("Route")
        assert route is not None and route.narrows_structure
        assert "revenue" not in route.permitted
        # `Airport` is not one of the named model's types, so nothing reached it.
        airport = compiled.bound_for("Airport")
        assert airport is not None and not airport.narrows_structure

    def test_a_closed_layer_admits_the_named_models_types_and_no_others(self, version: GraphVersion) -> None:
        """*EU · H1 2026* — closing the layer and naming one model is a bound,
        not a refusal, and it admits exactly what that model declares."""
        lens = to_effective_like(
            rules=[Rule(match="graph_data/model/Deals@*", allow=True, select={"time": {"from": "2026-01-01"}})],
            closed={Layer.graph_data},
        )

        compiled = build_query_lens(lens, version=version, verdict=lens.decide(ADDRESS), bindings=[self.DEALS])

        assert compiled.allowed_types == frozenset({"Route"})
        assert not compiled.allows_type("Airport")
        route = compiled.bound_for("Route")
        assert route is not None and route.predicates is not None
        assert [c.property for c in route.predicates.conditions] == ["observed_at"]

    def test_the_slice_compiles_against_the_named_models_axes(self, version: GraphVersion) -> None:
        """The mirror declares no axes, so resolving the slice against it would
        compile to nothing and read as *nobody narrowed it* ([GV14])."""
        mirror_without_axes = version
        mirror_without_axes.axes = {}
        lens = Effective(
            rules=[Rule(match="graph_data/model/Deals@*", allow=True, select={"time": {"to": "2026-06-30"}})]
        )

        compiled = build_query_lens(
            lens, version=mirror_without_axes, verdict=lens.decide(ADDRESS), bindings=[self.DEALS]
        )

        route = compiled.bound_for("Route")
        assert route is not None and route.predicates is not None
        assert [c.property for c in route.predicates.conditions] == ["observed_at"]

    def test_a_model_no_rule_reached_says_nothing_about_its_types(self, version: GraphVersion) -> None:
        """A binding nobody wrote a rule about must not narrow, and must not
        widen — it is simply silent ([GV7])."""
        lens = Effective(
            rules=[Rule(match="graph_data/model/Elsewhere@*", allow=True, properties={"exclude": ["revenue"]})]
        )

        compiled = build_query_lens(lens, version=version, verdict=lens.decide(ADDRESS), bindings=[self.DEALS])

        assert compiled.is_empty

    def test_the_touch_carries_the_slice_and_the_exclusions_per_type(self, version: GraphVersion) -> None:
        """WO17 — the read's own verdict carries neither, so both come off the
        compiled lens or the step dashboard renders nothing."""
        lens = to_effective_like(
            rules=[
                Rule(
                    match="graph_data/model/Deals@*",
                    allow=True,
                    select={"time": {"from": "2026-01-01"}},
                    properties={"exclude": ["revenue"]},
                )
            ],
            closed={Layer.graph_data},
        )
        own = lens.decide(ADDRESS)

        compiled = compile_lens(lens, version=version, verdict=own, bindings=[self.DEALS])

        # The gap this closes: the verdict is empty on exactly this shape.
        assert own.select == {} and own.properties_excluded == []
        assert compiled.selects == {"Route": {"time": {"from": "2026-01-01"}}}
        assert compiled.excluded == {"Route": ("revenue",)}
        # A type nobody narrowed is absent, never an empty entry.
        assert "Airport" not in compiled.selects

    def test_a_world_that_narrows_nothing_carries_nothing(self, version: GraphVersion) -> None:
        """WO17 — an empty map would claim a narrowing happened and name none."""
        compiled = compile_lens(
            Effective(rules=[Rule(match="graph_data/**", allow=True)]),
            version=version,
            verdict=Effective().decide(ADDRESS),
            bindings=[self.DEALS],
        )

        assert compiled.query_lens.is_empty
        assert compiled.selects == {} and compiled.excluded == {}

    def test_a_deny_on_a_named_model_removes_its_types(self, version: GraphVersion) -> None:
        """Deny wins at any specificity ([GV5]), one grain down: the type goes."""
        lens = to_effective_like(
            rules=[Rule(match=ADDRESS, allow=True), Rule(match="graph_data/model/Deals@*", allow=False)],
            closed={Layer.graph_data},
        )

        compiled = build_query_lens(lens, version=version, verdict=lens.decide(ADDRESS), bindings=[self.DEALS])

        assert not compiled.allows_type("Route")
        assert compiled.allows_type("Airport")
