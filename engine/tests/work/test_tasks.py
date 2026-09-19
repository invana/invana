"""The task status machine and dependencies (docs/for-developers/modules/work/spec.md), against a real Postgres.

What is worth testing here is the governance, not the CRUD: an agent posts a
result and a human accepts; a dependency blocks and then releases with the
*cause* on the record; a loop is refused by name.
"""

from __future__ import annotations

import pytest

from invana.apps.agents.models import AgentStatus
from invana.apps.work.managers import DependencyManager, ProjectManager, TaskManager
from invana.apps.work.models import Task, TaskStatus
from invana.apps.work.schemas import DependencyCreate, TaskCreate, TaskResultRequest, TaskUpdate
from invana.core.errors import ConflictError, ValidationError
from invana.core.events.models import ActorKind, Event

tasks = TaskManager()
deps = DependencyManager()
projects = ProjectManager()

pytestmark = pytest.mark.asyncio


async def _task(session, graph, user, title: str = "Review suppliers", **kwargs) -> Task:
    payload = TaskCreate(title=title, body="Which suppliers are single-sourced?", **kwargs)
    return await tasks.create(session, graph=graph, payload=payload, actor=user)


class TestAssignment:
    async def test_assigning_to_an_agent_opens_exactly_one_thinking(self, session, graph, user, agent):
        task = await _task(session, graph, user)
        await tasks.assign(session, graph=graph, task=task, assignee_kind="agent", assignee_id=agent.id, actor=user)
        await session.flush()

        assert task.status == TaskStatus.in_progress.value
        runs = list((await session.execute(_select_thinkings(task.id))).scalars().all())
        assert len(runs) == 1
        # The trace's spine: the agent acted, and it names the human it acted for.
        assert runs[0].on_behalf_of_user_id == user.id
        assert runs[0].triggered_by == "task"

    async def test_assigning_to_a_member_does_not_open_a_thinking(self, session, graph, user):
        task = await _task(session, graph, user)
        await tasks.assign(session, graph=graph, task=task, assignee_kind="user", assignee_id=user.id, actor=user)
        await session.flush()
        assert task.status == TaskStatus.assigned.value
        assert (await session.execute(_select_thinkings(task.id))).scalars().all() == []

    async def test_a_paused_agent_blocks_the_task_instead_of_running_it(self, session, graph, user, agent):
        agent.status = AgentStatus.paused.value
        await session.flush()
        task = await _task(session, graph, user)
        await tasks.assign(session, graph=graph, task=task, assignee_kind="agent", assignee_id=agent.id, actor=user)
        await session.flush()
        assert task.status == TaskStatus.blocked.value
        assert "paused" in task.blocked_reason


class TestReviewAndAccept:
    async def test_an_agent_posts_a_result_and_a_human_accepts(self, session, graph, user, agent):
        task = await _task(session, graph, user)
        await tasks.post_result(
            session,
            graph=graph,
            task=task,
            payload=TaskResultRequest(summary="14 suppliers", run_ids=[], emitted=[]),
            actor_kind=ActorKind.agent,
            actor_id=agent.id,
            actor_name=agent.name,
            on_behalf_of_user_id=user.id,
        )
        await session.flush()
        # Never `done` — that is the governance seam.
        assert task.status == TaskStatus.review.value

        await tasks.accept(session, graph=graph, task=task, actor=user)
        await session.flush()
        assert task.status == TaskStatus.done.value
        assert task.closed_at is not None

    async def test_accepting_a_task_that_is_not_in_review_is_a_conflict(self, session, graph, user):

        task = await _task(session, graph, user)
        with pytest.raises(ConflictError):
            await tasks.accept(session, graph=graph, task=task, actor=user)

    async def test_a_rejection_is_a_new_round_not_an_overwrite(self, session, graph, user, agent):
        task = await _task(session, graph, user)
        await tasks.assign(session, graph=graph, task=task, assignee_kind="agent", assignee_id=agent.id, actor=user)
        await tasks.post_result(
            session,
            graph=graph,
            task=task,
            payload=TaskResultRequest(summary="first pass"),
            actor_kind=ActorKind.agent,
            actor_id=agent.id,
            on_behalf_of_user_id=user.id,
        )
        await session.flush()
        await tasks.reject(session, graph=graph, task=task, note="Only Tier 1, please.", actor=user)
        await session.flush()

        assert task.status == TaskStatus.in_progress.value
        assert task.result is None
        # Two runs on one task: every round stays on the record.
        assert len((await session.execute(_select_thinkings(task.id))).scalars().all()) == 2

    async def test_a_parent_cannot_post_a_result_while_a_sub_task_is_open(self, session, graph, user):

        parent = await _task(session, graph, user, title="Parent")
        await session.flush()
        await _task(session, graph, user, title="Child", parent_id=parent.id)
        await session.flush()
        with pytest.raises(ConflictError):
            await tasks.post_result(
                session,
                graph=graph,
                task=parent,
                payload=TaskResultRequest(summary="done"),
                actor_kind=ActorKind.user,
                actor_id=user.id,
            )


class TestDependencies:
    async def test_a_dependency_blocks_and_accepting_it_releases_with_the_cause(self, session, graph, user):
        first = await _task(session, graph, user, title="Load data")
        second = await _task(session, graph, user, title="Review data")
        await session.flush()
        await tasks.assign(session, graph=graph, task=second, assignee_kind="user", assignee_id=user.id, actor=user)
        await deps.add(session, graph=graph, task=second, payload=DependencyCreate(depends_on_id=first.id), actor=user)
        await session.flush()
        assert second.status == TaskStatus.blocked.value
        assert "Load data" in second.blocked_reason

        await tasks.post_result(
            session,
            graph=graph,
            task=first,
            payload=TaskResultRequest(summary="loaded"),
            actor_kind=ActorKind.user,
            actor_id=user.id,
        )
        await tasks.accept(session, graph=graph, task=first, actor=user)
        await session.flush()

        assert second.status == TaskStatus.assigned.value
        assert second.blocked_reason is None
        # The trace answers *why* it started, not just that it did.
        unblock = [
            e for e in (await session.execute(_select_events(second.id))).scalars().all() if e.details.get("cause")
        ]
        assert unblock and unblock[0].details["cause"].startswith("task.done")
        assert unblock[0].parent_event_id is not None

    async def test_a_cycle_is_refused_and_names_the_loop(self, session, graph, user):

        a = await _task(session, graph, user, title="Alpha")
        b = await _task(session, graph, user, title="Beta")
        await session.flush()
        await deps.add(session, graph=graph, task=b, payload=DependencyCreate(depends_on_id=a.id), actor=user)
        await session.flush()
        with pytest.raises(ValidationError) as caught:
            await deps.add(session, graph=graph, task=a, payload=DependencyCreate(depends_on_id=b.id), actor=user)
        assert "Alpha" in caught.value.detail and "Beta" in caught.value.detail

    async def test_a_task_cannot_wait_on_itself(self, session, graph, user):

        task = await _task(session, graph, user)
        await session.flush()
        with pytest.raises(ValidationError):
            await deps.add(session, graph=graph, task=task, payload=DependencyCreate(depends_on_id=task.id), actor=user)

    async def test_removing_the_last_dependency_unblocks(self, session, graph, user):
        first = await _task(session, graph, user, title="A")
        second = await _task(session, graph, user, title="B")
        await session.flush()
        await deps.add(session, graph=graph, task=second, payload=DependencyCreate(depends_on_id=first.id), actor=user)
        await session.flush()
        await deps.remove(session, graph=graph, task=second, depends_on_id=first.id, actor=user)
        await session.flush()
        assert second.status == TaskStatus.open.value


class TestArchivedProject:
    async def test_an_archived_project_freezes_its_tasks(self, session, graph, user):
        from invana.apps.work.schemas import ProjectCreate, ProjectUpdate

        project = await projects.create(
            session, graph_id=graph.id, payload=ProjectCreate(name="Supply chain"), actor=user
        )
        await session.flush()
        task = await _task(session, graph, user, project_key=project.key)
        await session.flush()
        await projects.update(session, project=project, payload=ProjectUpdate(status="archived"), actor=user)
        await session.flush()
        with pytest.raises(ConflictError):
            await tasks.update(session, graph=graph, task=task, payload=TaskUpdate(title="new title"), actor=user)


class TestProjectCreator:
    """`created by` is a name on the detail, so the read resolves it (PT8)."""

    async def test_a_project_read_names_its_creator(self, session, graph, user):
        from invana.apps.work.schemas import ProjectCreate

        project = await projects.create(
            session, graph_id=graph.id, payload=ProjectCreate(name="Supply chain"), actor=user
        )
        await session.flush()

        read = await projects.read(session, project=project)
        assert read.created_by_name == user.username
        listed = await projects.list_for_graph(session, graph_id=graph.id)
        assert [p.created_by_name for p in listed] == [user.username]

    async def test_a_creator_who_is_gone_reads_as_no_name(self, session, graph, user):
        """Never a bare id in the heading — the row survives its author."""
        from invana.apps.work.schemas import ProjectCreate

        project = await projects.create(session, graph_id=graph.id, payload=ProjectCreate(name="Orphaned"), actor=user)
        project.created_by_id = None
        await session.flush()

        read = await projects.read(session, project=project)
        assert read.created_by_name is None


class TestUnarchive:
    """Archiving is reversible, and each direction is its own event (PT11)."""

    async def test_unarchiving_reopens_the_project_and_its_tasks(self, session, graph, user):
        from invana.apps.work.schemas import ProjectCreate, ProjectUpdate

        project = await projects.create(
            session, graph_id=graph.id, payload=ProjectCreate(name="Supply chain"), actor=user
        )
        await session.flush()
        task = await _task(session, graph, user, project_key=project.key)
        await projects.update(session, project=project, payload=ProjectUpdate(status="archived"), actor=user)
        await session.flush()

        await projects.update(session, project=project, payload=ProjectUpdate(status="active"), actor=user)
        await session.flush()

        assert project.status == "active"
        # The freeze lifts with it — the whole point of archiving being reversible.
        await tasks.update(session, graph=graph, task=task, payload=TaskUpdate(title="new title"), actor=user)
        await session.flush()
        assert task.title == "new title"

        actions_logged = [e.action for e in (await session.execute(_select_project_events(project.id))).scalars().all()]
        assert actions_logged == ["project.create", "project.archive", "project.unarchive"]


def _select_project_events(project_id: str):
    from sqlalchemy import select

    return select(Event).where(Event.target_id == project_id).order_by(Event.created_at, Event.id)


def _select_thinkings(task_id: str):
    from sqlalchemy import select

    from invana.runtime.models import TaskRun

    return select(TaskRun).where(TaskRun.todo_id == task_id)


def _select_events(task_id: str):
    from sqlalchemy import select

    return select(Event).where(Event.task_id == task_id)
