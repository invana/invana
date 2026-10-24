"""Drawing a playbook: one candidate, two, none — and the sentence that is not
an instruction (docs/for-developers/modules/skills/features/authoring-a-skill.md SK24).

The model's half is its own; what is tested here is the part that must be
**counted rather than judged**, and what it writes.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.envelope import Envelope
from invana.apps.flows.managers import FlowManager
from invana.apps.graphs.models import Graph
from invana.apps.llm.draft import Candidate, DraftedPlaybook, DraftedSentence
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import SkillCreate, SkillVersionPublish
from invana.core.auth.models import User
from invana.plugins import load_plugins
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.managers import SkillDraftManager
from invana.runtime.planning import resolve_plan

pytestmark = pytest.mark.asyncio

skills = SkillManager()
drafts = SkillDraftManager()
plans = FlowManager()
#: The catalogue's `requires`, handed down — an app may not read band 3.
_REQUIRES = {key: entry.requires for key, entry in CATALOGUE.items()}

ENVELOPE = Envelope.from_spec({"allow": ["nl.translate", "graph.read.validate", "graph.read.query", "answer.shape"]})


def _drafted(*sentences: DraftedSentence) -> DraftedPlaybook:
    return DraftedPlaybook(sentences=list(sentences))


async def _draft_of(session: AsyncSession, graph: Graph, user: User, name: str, content: str):
    skill = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name=name, content=content),
        actor_id=user.id,
    )
    return skill, await drafts.ensure_draft(session, skill=skill)


async def test_one_reading_is_a_step_none_is_a_person_and_prose_is_unmapped(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill, draft = await _draft_of(session, graph, user, "Chase", "…")
    drafted = _drafted(
        DraftedSentence(
            span="Turn the question into a query.",
            kind="step",
            candidates=(Candidate(task="nl.translate", label="Understand"),),
        ),
        DraftedSentence(span="Telephone the supplier.", kind="step", candidates=()),
        DraftedSentence(span="Be concise.", kind="not_an_instruction"),
    )

    out = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=drafted, envelope=ENVELOPE, validate=resolve_plan
    )

    assert out.rejected is None
    assert out.output["steps"] == 2
    assert out.output["unmapped"] == ["Be concise."]

    plan = await drafts.plan_read(session, version=draft)
    assert [(n.task, n.layer) for n in plan.nodes] == [("nl.translate", "llm"), ("", "human")]
    # Every node names the sentence it came from (C11).
    assert plan.nodes[0].source_span == "Turn the question into a query."
    assert plan.nodes[1].source_span == "Telephone the supplier."
    # It was drawn, so the plan is the planner's until someone edits it (SK7).
    assert plan.origin == "generated"


async def test_two_readings_stop_and_ask_and_the_answer_is_not_asked_again(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill, draft = await _draft_of(session, graph, user, "Ambiguous", "…")
    ambiguous = DraftedSentence(
        span="Check it before it runs.",
        kind="step",
        candidates=(
            Candidate(task="graph.read.validate", label="Validate", why="check the query is read-only"),
            Candidate(task="answer.shape", label="Project", why="check what the canvas gets"),
        ),
    )

    asked = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=_drafted(ambiguous), envelope=ENVELOPE, validate=resolve_plan
    )

    assert asked.output["steps"] == 0, "nothing is written until it is answered (C10)"
    assert asked.output["span"] == "Check it before it runs."
    assert asked.output["options"] == ["graph.read.validate", "answer.shape"]
    plan = await drafts.plan_read(session, version=draft)
    assert len(plan.nodes) == 1 and plan.nodes[0].form == "human", "the draft still has its one node"

    read = await drafts.answer(
        session,
        skill=skill,
        clarification_id=asked.output["clarification_id"],
        answer="graph.read.validate",
        actor_id=user.id,
    )
    assert read.open_clarification is None

    # The redraw reads the answer rather than asking again (SK11).
    subject = await drafts.drawing(session, version_id=draft.id)
    assert subject.answered == {"Check it before it runs.": "graph.read.validate"}
    again = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=_drafted(ambiguous), envelope=ENVELOPE, validate=resolve_plan
    )
    assert again.output["steps"] == 1
    plan = await drafts.plan_read(session, version=draft)
    assert [n.task for n in plan.nodes] == ["graph.read.validate"]


async def test_a_step_the_envelope_forbids_is_rejected_rather_than_written(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    _skill, draft = await _draft_of(session, graph, user, "Forbidden", "…")
    drafted = _drafted(
        DraftedSentence(
            span="Write the answer back into the graph.",
            kind="step",
            candidates=(Candidate(task="graph.write.records", label="Write"),),
        )
    )

    out = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=drafted, envelope=ENVELOPE, validate=resolve_plan
    )

    assert out.rejected, "a plan the envelope forbids is refused before a row is written"
    # It settles carrying its reasons rather than raising, so the draft can show
    # them where the flow would have been (SK31).
    assert out.output["steps"] == 0
    assert out.output["refused"] == out.rejected
    plan = await drafts.plan_read(session, version=draft)
    assert len(plan.nodes) == 1 and plan.nodes[0].form == "human"


async def test_a_prerequisite_the_prose_never_named_is_refused_by_name(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """SK31 — the refusal a real playbook actually hits.

    *Read it, run it* draws two allowed steps, and still does not hold together:
    ``graph.read.query`` requires ``graph.read.validate``, which the catalogue
    declares and the prose never said. The reason names the step, so rewriting
    the sentence is something the author can actually do.
    """
    _skill, draft = await _draft_of(session, graph, user, "No check", "Read it. Run it.")
    drafted = _drafted(
        DraftedSentence(
            span="Turn the question into a query.",
            kind="step",
            candidates=(Candidate(task="nl.translate", label="Translate"),),
        ),
        DraftedSentence(
            span="Run it against the graph.",
            kind="step",
            candidates=(Candidate(task="graph.read.query", label="Run"),),
        ),
    )

    out = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=drafted, envelope=ENVELOPE, validate=resolve_plan
    )

    assert out.rejected and any("requires 'graph.read.validate'" in reason for reason in out.rejected)
    assert out.output["refused"] == out.rejected
    plan = await drafts.plan_read(session, version=draft)
    assert len(plan.nodes) == 1, "a refused draw leaves the plan that was there untouched"


async def test_a_drafts_plan_is_born_generated_so_authored_means_a_person_wrote_it(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """SK29 — nobody wrote the one node a draft starts with.

    Calling it ``authored`` made the surface warn that a draw would discard
    work that does not exist, and left it unable to tell a correction from a
    plan nothing has touched.
    """
    _skill, draft = await _draft_of(session, graph, user, "Born", "Read it.")

    born = await drafts.plan_read(session, version=draft)
    assert born.origin == "generated"
    assert [n.source_span for n in born.nodes] == [None], "nothing drew it, so no sentence claims it"


async def test_a_plan_a_person_does_every_step_of_is_written_not_refused(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """A person is the universal fallback, so a catalogue gap never blocks
    publishing. A plan of only those rows reaches the envelope with nothing to
    validate, and *nothing to validate* is not *no steps*."""
    _skill, draft = await _draft_of(session, graph, user, "By hand only", "Telephone them. Write it up.")
    drafted = _drafted(
        DraftedSentence(span="Telephone them.", kind="step", candidates=()),
        DraftedSentence(span="Write it up.", kind="step", candidates=()),
    )

    out = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=drafted, envelope=ENVELOPE, validate=resolve_plan
    )

    assert out.rejected is None
    plan = await drafts.plan_read(session, version=draft)
    assert [(n.form, n.source_span) for n in plan.nodes] == [("human", "Telephone them."), ("human", "Write it up.")]
    assert plan.layers == ["human"]


# ── a sentence that names a library plan ─────────────────────────────────────

#: `nl-single@2` ends in `plan.verify`, so the drawing envelope must allow it.
ANSWERING = Envelope.from_spec(
    {
        "allow": [
            "nl.translate",
            "graph.read.validate",
            "graph.read.query",
            "answer.shape",
            "plan.verify",
        ]
    }
)


async def test_a_sentence_that_names_a_library_plan_draws_its_rows_flat_and_tuned(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """The plan's rows are copied in at the draw, flat, each naming where it
    came from, with the argument the sentence tunes — and the composition is
    recorded on the plan."""
    skill, draft = await _draft_of(session, graph, user, "Inlined", "Answer it, writes allowed. Tell the desk.")
    await plans.ensure_seeded(session, graph_id=graph.id, flows=load_plugins().flows.values(), requires=_REQUIRES)
    offered = {p.ref for p in await drafts.inlinable(session, graph_id=graph.id)}
    assert "nl-single@2" in offered, "the planner is offered the library"
    drafted = _drafted(
        DraftedSentence(
            span="Answer it, writes allowed.",
            kind="step",
            candidates=(Candidate(task="plan:nl-single@2", label="Answer", tune={"read_only": False}),),
        ),
        DraftedSentence(span="Tell the desk.", kind="step", candidates=()),
    )

    out = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=drafted, envelope=ANSWERING, validate=resolve_plan
    )

    assert out.rejected is None
    read = await drafts.plan_read(session, version=draft)
    steps = [n for n in read.nodes if n.form == "callable"]
    copied = ("nl_translate", "graph_read_validate", "graph_read_query", "answer_shape", "plan_verify")
    assert [n.id for n in steps] == [f"nl_single_{step}" for step in copied], "flat, prefixed siblings"
    assert {n.source_span for n in steps} == {"Answer it, writes allowed."}
    execute = next(n for n in steps if n.task == "graph.read.query")
    assert execute.args["read_only"] is False, "the tuned value, not the declared default"
    # The copied plan's own binding follows its rows.
    assert execute.args["query"] == "${steps.nl_single_nl_translate.query}"

    plan = await drafts.plans_qs.get(session, draft.plan_id)
    assert plan.origin == "generated"
    assert plan.uses == [{"key": "nl-single", "version": 2, "args": {"read_only": False}}]
    rows = await drafts.plans_qs.tasks_for(session, plan_id=plan.id)
    assert {r.key: (r.source_plan_key, r.source_step_key) for r in rows if r.source_plan_key} == {
        f"nl_single_{step}": ("nl-single@2", step) for step in copied
    }
    [use] = read.uses
    assert (use.key, use.version, use.latest_version) == ("nl-single", 2, 2)

    # A draft opened over the published version keeps the composition with the rows.
    await drafts.publish(session, skill=skill, payload=SkillVersionPublish(), actor_id=user.id)
    reopened = await drafts.ensure_draft(session, skill=skill)
    again = await drafts.plans_qs.get(session, reopened.plan_id)
    assert again.uses == plan.uses


@pytest.mark.parametrize(
    ("task", "tune", "named"),
    [
        ("plan:nl-single@2", {"read_onyl": True}, "read_onyl"),
        ("plan:no-such-plan@1", {}, "no-such-plan@1"),
    ],
)
async def test_a_plan_that_cannot_be_inlined_refuses_the_draw_by_name(
    session: AsyncSession, graph: Graph, user: User, task: str, tune: dict, named: str
) -> None:
    """An argument the plan does not declare is a typo, and an unknown plan is
    not on offer; either settles the draw with the reason and writes nothing."""
    _skill, draft = await _draft_of(session, graph, user, "Typo", "Answer it.")
    await plans.ensure_seeded(session, graph_id=graph.id, flows=load_plugins().flows.values(), requires=_REQUIRES)
    drafted = _drafted(
        DraftedSentence(span="Answer it.", kind="step", candidates=(Candidate(task=task, label="A", tune=tune),))
    )

    out = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=drafted, envelope=ANSWERING, validate=resolve_plan
    )

    assert out.rejected and named in out.rejected[0] and "Answer it." in out.rejected[0]
    plan = await drafts.plan_read(session, version=draft)
    assert len(plan.nodes) == 1 and plan.nodes[0].form == "human", "the plan that was there is untouched"


async def test_reseeding_rewrites_a_packaged_plans_description(session: AsyncSession, graph: Graph) -> None:
    """A packaged plan's text is the package's, so a Graph seeded before an
    edit reads the edited text; a promoted plan's own text is never touched."""
    flows = list(load_plugins().flows.values())
    await plans.ensure_seeded(session, graph_id=graph.id, flows=flows, requires=_REQUIRES)
    plan = await plans.flows_qs.find_by_key(session, graph_id=graph.id, key="nl-single", version=2)
    plan.description = "stale text"
    await session.flush()

    await plans.ensure_seeded(session, graph_id=graph.id, flows=flows, requires=_REQUIRES)

    await session.refresh(plan)
    packaged = next(f for f in flows if (f.key, f.version) == ("nl-single", 2))
    assert plan.description == packaged.description
