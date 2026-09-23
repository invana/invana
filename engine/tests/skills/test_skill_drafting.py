"""Drawing a playbook: one candidate, two, none — and the sentence that is not
an instruction (docs/for-developers/modules/skills/features/authoring-a-skill.md SK24).

The model's half is its own; what is tested here is the part that must be
**counted rather than judged**, and what it writes.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.envelope import Envelope
from invana.apps.graphs.models import Graph
from invana.apps.llm.draft import Candidate, DraftedPlaybook, DraftedSentence
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import SkillCreate, SkillDraftTaskWrite
from invana.apps.task_plans.managers import TaskPlanManager
from invana.apps.task_plans.models import TaskPlan
from invana.core.auth.models import User
from invana.core.errors import ValidationError
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.managers import SkillDraftManager
from invana.runtime.planning import resolve_plan

pytestmark = pytest.mark.asyncio

skills = SkillManager()
drafts = SkillDraftManager()
plans = TaskPlanManager()
#: The catalogue's `requires`, handed down — an app may not read band 3.
_REQUIRES = {key: entry.requires for key, entry in CATALOGUE.items()}

ENVELOPE = Envelope.from_spec(
    {"allow": ["translate_thought", "validate_query", "execute_graph_query", "shape_for_canvas"]}
)


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
            candidates=(Candidate(task="translate_thought", label="Understand"),),
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
    assert [(n.task, n.layer) for n in plan.nodes] == [("translate_thought", "llm"), ("", "human")]
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
            Candidate(task="validate_query", label="Validate", why="check the query is read-only"),
            Candidate(task="shape_for_canvas", label="Project", why="check what the canvas gets"),
        ),
    )

    asked = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=_drafted(ambiguous), envelope=ENVELOPE, validate=resolve_plan
    )

    assert asked.output["steps"] == 0, "nothing is written until it is answered (C10)"
    assert asked.output["span"] == "Check it before it runs."
    assert asked.output["options"] == ["validate_query", "shape_for_canvas"]
    plan = await drafts.plan_read(session, version=draft)
    assert len(plan.nodes) == 1 and plan.nodes[0].form == "human", "the draft still has its one node"

    read = await drafts.answer(
        session,
        skill=skill,
        clarification_id=asked.output["clarification_id"],
        answer="validate_query",
        actor_id=user.id,
    )
    assert read.open_clarification is None

    # The redraw reads the answer rather than asking again (SK11).
    subject = await drafts.drawing(session, version_id=draft.id)
    assert subject.answered == {"Check it before it runs.": "validate_query"}
    again = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=_drafted(ambiguous), envelope=ENVELOPE, validate=resolve_plan
    )
    assert again.output["steps"] == 1
    plan = await drafts.plan_read(session, version=draft)
    assert [n.task for n in plan.nodes] == ["validate_query"]


async def test_a_step_the_envelope_forbids_is_rejected_rather_than_written(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    _skill, draft = await _draft_of(session, graph, user, "Forbidden", "…")
    drafted = _drafted(
        DraftedSentence(
            span="Write the answer back into the graph.",
            kind="step",
            candidates=(Candidate(task="write_graph", label="Write"),),
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
    ``execute_graph_query`` requires ``validate_query``, which the catalogue
    declares and the prose never said. The reason names the step, so rewriting
    the sentence is something the author can actually do.
    """
    _skill, draft = await _draft_of(session, graph, user, "No check", "Read it. Run it.")
    drafted = _drafted(
        DraftedSentence(
            span="Turn the question into a query.",
            kind="step",
            candidates=(Candidate(task="translate_thought", label="Translate"),),
        ),
        DraftedSentence(
            span="Run it against the graph.",
            kind="step",
            candidates=(Candidate(task="execute_graph_query", label="Run"),),
        ),
    )

    out = await drafts.apply_drawing(
        session, version_id=draft.id, drafted=drafted, envelope=ENVELOPE, validate=resolve_plan
    )

    assert out.rejected and any("requires 'validate_query'" in reason for reason in out.rejected)
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


# ── the hand-edit (SK7 · SK28) ───────────────────────────────────────────────


async def test_a_hand_edit_replaces_the_rows_and_takes_ownership_of_the_plan(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """SK7 — writing the rows flips `origin` to `authored`, and the spans stay."""
    skill, draft = await _draft_of(session, graph, user, "By hand", "Read it. Run it.")
    before = await drafts.plan_read(session, version=draft)
    # Born `generated` (SK29), so the flip below is caused by the hand-edit and
    # by nothing else.
    assert before.origin == "generated" and before.nodes[0].form == "human"

    read = await drafts.write_tasks(
        session,
        skill=skill,
        tasks=[
            SkillDraftTaskWrite(step_key="translate_thought", title="Understand", source_span="Read it."),
            SkillDraftTaskWrite(
                step_key="validate_query",
                title="Check",
                args={"query": "${steps.translate_thought.query}"},
                source_span="Run it.",
            ),
            SkillDraftTaskWrite(form="human", title="Telephone the supplier."),
        ],
        validate=resolve_plan,
    )

    assert read.plan.origin == "authored"
    assert [n.task for n in read.plan.nodes] == ["translate_thought", "validate_query", ""]
    # The bands the Flow tab draws, and the sentence each step answers to (C11).
    assert read.plan.layers == ["llm", "human", "agent"]
    assert [n.source_span for n in read.plan.nodes[:2]] == ["Read it.", "Run it."]
    # The binding is an edge, not a guess.
    assert any(e.source == "translate_thought" and e.kind == "binding" for e in read.plan.edges)


async def test_a_hand_edit_is_bounded_by_the_catalogue_and_never_by_no_steps(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """SK28 — the closed set is the bound here; the envelope is the agent's, at
    bind time. And a playbook with no steps is a rule, not a skill."""
    skill, _draft = await _draft_of(session, graph, user, "Nowhere", "…")

    with pytest.raises(ValidationError) as unknown:
        await drafts.write_tasks(
            session,
            skill=skill,
            tasks=[SkillDraftTaskWrite(step_key="telephone_the_supplier", title="Call")],
            validate=resolve_plan,
        )
    assert "telephone_the_supplier" in str(unknown.value.detail)

    with pytest.raises(ValidationError) as empty:
        await drafts.write_tasks(session, skill=skill, tasks=[], validate=resolve_plan)
    assert "rule" in str(empty.value.detail)

    # The plan is still checked as a plan: `write_graph` declares what must run
    # before it, and a hand-edit cannot write an order the runtime would refuse.
    with pytest.raises(ValidationError) as unordered:
        await drafts.write_tasks(
            session,
            skill=skill,
            tasks=[SkillDraftTaskWrite(step_key="write_graph", title="Write")],
            validate=resolve_plan,
        )
    assert "validate_records" in str(unordered.value.detail)

    # And `write_graph` is outside every seeded envelope yet in the catalogue,
    # so authoring it is allowed — binding it is where an agent refuses (BN5).
    read = await drafts.write_tasks(
        session,
        skill=skill,
        tasks=[
            SkillDraftTaskWrite(step_key="validate_records", title="Check the records"),
            SkillDraftTaskWrite(step_key="write_graph", title="Write"),
        ],
        validate=resolve_plan,
    )
    assert [n.task for n in read.plan.nodes] == ["validate_records", "write_graph"]


async def test_a_plan_a_person_does_every_step_of_is_written_not_refused(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """SK15 · SK22 — `form: human` is the universal fallback, so a catalogue gap
    never blocks publishing. A plan of only those rows reaches the envelope with
    nothing to validate, and *nothing to validate* is not *no steps*."""
    skill, _draft = await _draft_of(session, graph, user, "By hand only", "Telephone them. Write it up.")

    read = await drafts.write_tasks(
        session,
        skill=skill,
        tasks=[
            SkillDraftTaskWrite(form="human", title="Telephone the supplier.", source_span="Telephone them."),
            SkillDraftTaskWrite(form="human", title="Write it up.", source_span="Write it up."),
        ],
        validate=resolve_plan,
    )

    assert [n.form for n in read.plan.nodes] == ["human", "human"]
    assert read.plan.layers == ["human"]
    assert read.plan.origin == "authored"


# ── inlining a library plan (SK32 · SK33 · LB19 · LB20) ──────────────────────


async def test_a_uses_row_becomes_the_plans_rows_flat_and_tuned(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """SK32 · SK33 — the rows are copied in, flat, each naming where it came from.

    `nl-single@1` declares `read_only`, and this skill wants the other value.
    Tuning it is a property of the call, so neither plan is edited and neither
    is a fork (LB19).
    """
    skill, _draft = await _draft_of(session, graph, user, "Inlined", "Answer it.")
    await plans.ensure_seeded(session, graph_id=graph.id, requires=_REQUIRES)

    read = await drafts.write_tasks(
        session,
        skill=skill,
        tasks=[
            SkillDraftTaskWrite(key="answer", form="uses", uses="nl-single@2", uses_args={"read_only": False}),
            SkillDraftTaskWrite(form="human", title="Tell the desk."),
        ],
        validate=resolve_plan,
    )

    steps = [n for n in read.plan.nodes if n.form == "callable"]
    assert [n.id for n in steps] == [
        "answer_translate_thought",
        "answer_validate_query",
        "answer_execute_graph_query",
        "answer_shape_for_canvas",
        "answer_verify_result",
    ], "flat siblings, prefixed so two inlined plans cannot collide"
    execute = next(n for n in steps if n.task == "execute_graph_query")
    assert execute.args["read_only"] is False, "the tuned value, not the declared default"
    # The copied plan's own binding follows its rows rather than pointing at
    # whatever the skill happens to call `translate_thought`.
    assert execute.args["query"] == "${steps.answer_translate_thought.query}"

    plan = await drafts.plans_qs.get(session, read.version.plan_id)
    assert plan.uses == [{"key": "nl-single", "version": 2, "args": {"read_only": False}}]
    rows = await drafts.plans_qs.tasks_for(session, plan_id=plan.id)
    assert {r.source_plan_key for r in rows} == {"nl-single@2", None}
    # What the Flow tab reads back: the composition, and whether the library
    # has moved past it. `@2` is the newest, so this one has not.
    [use] = read.plan.uses
    assert (use.key, use.version, use.latest_version) == ("nl-single", 2, 2)
    assert use.args == {"read_only": False}


async def test_inlining_an_older_version_says_a_newer_one_exists(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """SK32 — *a newer version exists* is said, never acted on: the copy is what
    makes a published skill do tomorrow what it did today."""
    skill, _draft = await _draft_of(session, graph, user, "Behind", "Answer it.")
    await plans.ensure_seeded(session, graph_id=graph.id, requires=_REQUIRES)

    read = await drafts.write_tasks(
        session,
        skill=skill,
        tasks=[SkillDraftTaskWrite(key="answer", form="uses", uses="nl-single@2")],
        validate=resolve_plan,
    )
    assert read.plan.uses[0].latest_version == 2, "nothing newer yet"

    # The library publishes `@3`. The skill's rows do not move (SK32), and the
    # read is what says so.
    seeded = await drafts.plans_qs.find_by_key(session, graph_id=graph.id, key="nl-single", version=2)
    await drafts.plans_qs.add(
        session,
        TaskPlan(
            graph_id=graph.id,
            key="nl-single",
            version=3,
            name=seeded.name,
            description=seeded.description,
            kind=seeded.kind,
            origin=seeded.origin,
            intent=list(seeded.intent or []),
            args_schema=dict(seeded.args_schema or {}),
            source_skill_version_ids=[],
            reusable=True,
            created_by_kind="user",
        ),
    )

    again = await drafts.plan_read(session, version=read.version)
    [use] = again.uses
    assert (use.version, use.latest_version) == (2, 3)
    rows = await drafts.plans_qs.tasks_for(session, plan_id=read.version.plan_id)
    assert {r.source_plan_key for r in rows} == {"nl-single@2"}


async def test_an_argument_the_plan_does_not_declare_is_refused_by_name(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """LB20 — an argument nothing offers is a typo, and it is named as one."""
    skill, _draft = await _draft_of(session, graph, user, "Typo", "Answer it.")
    await plans.ensure_seeded(session, graph_id=graph.id, requires=_REQUIRES)

    with pytest.raises(ValidationError) as refused:
        await drafts.write_tasks(
            session,
            skill=skill,
            tasks=[SkillDraftTaskWrite(form="uses", uses="nl-single@2", uses_args={"read_onyl": True})],
            validate=resolve_plan,
        )
    assert "read_onyl" in str(refused.value) and "read_only" in str(refused.value)
