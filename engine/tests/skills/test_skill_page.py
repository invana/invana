"""The skill page's reads: handlers from the text, and replans over the runs offered it."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.handlers import handlers_of
from invana.apps.skills.schemas import SkillCreate
from invana.core.auth.models import User
from invana.runtime.managers import SkillDraftManager, SkillUsageManager
from invana.runtime.models import TaskRun

drafts = SkillDraftManager()
usage = SkillUsageManager()

_TEXT = """## Goal
Answer about routes.

## Steps
- Use web.search to find the timetable.

## When things go wrong
- If web.search finds nothing, ask the person.
- If search times out, retry once.
- Otherwise, say what is missing.

## Notes
- Not a handler.
"""

_NODES = [{"id": "plan_answer", "task": "plan.answer"}, {"id": "web_search", "task": "web.search"}]


def test_each_line_under_when_things_go_wrong_is_a_handler_naming_its_step():
    assert handlers_of(_TEXT, _NODES) == [
        {"span": "If web.search finds nothing, ask the person.", "step_id": "web_search"},
        {"span": "If search times out, retry once.", "step_id": "web_search"},
        {"span": "Otherwise, say what is missing.", "step_id": None},
    ]


def test_a_text_without_the_heading_has_no_handlers():
    assert handlers_of("## Steps\n- Use web.search.\n", _NODES) == []


async def test_exceptions_count_replans_over_the_runs_offered_the_skill(
    session: AsyncSession, graph: Graph, user: User
):
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Escalate"), actor_id=user.id, publish=True
    )
    empty = await usage.exceptions(session, skill=skill, graph_id=graph.id, days=30)
    assert (empty.runs, empty.replanned, empty.replans_p95, empty.hit_limit, empty.items) == (0, 0, None, 0, [])

    root = TaskRun(graph_id=graph.id, ask_kind="nl", body="why", status="succeeded", replans=2)
    session.add(root)
    await session.flush()
    session.add(TaskRun(graph_id=graph.id, parent_run_id=root.id, skills_offered=[skill.current_version_id]))
    session.add(TaskRun(graph_id=graph.id, ask_kind="nl", body="unrelated", status="succeeded", replans=5))
    await session.flush()

    read = await usage.exceptions(session, skill=skill, graph_id=graph.id, days=30)
    assert (read.runs, read.replanned, read.replans_p95, read.max_replans) == (1, 1, 2.0, None)


async def test_a_draft_reads_the_lines_its_last_draw_could_not_map(session: AsyncSession, graph: Graph, user: User):
    skill = await drafts.create(session, graph_id=graph.id, payload=SkillCreate(name="Mail the desk"), actor_id=user.id)
    draft = await drafts.ensure_draft(session, skill=skill)
    assert (await drafts.draft_read(session, skill=skill)).unmapped == []

    draw = TaskRun(
        graph_id=graph.id,
        role="plan",
        flow_key="skill-draft",
        params={"skill_version_id": draft.id},
        status="succeeded",
    )
    session.add(draw)
    await session.flush()
    span = "The desk prefers short notes."
    session.add(TaskRun(graph_id=graph.id, parent_run_id=draw.id, task_key="plan.draft", output={"unmapped": [span]}))
    await session.flush()

    assert (await drafts.draft_read(session, skill=skill)).unmapped == [span]
