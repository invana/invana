"""Agent lifecycle and lineage (docs/for-developers/modules/work/spec.md, § 7) — the parts that protect the trace.

Retire is not delete, a seeded agent is not deletable, and a spawned child's
reach is its parent's reach or narrower. Those three are what keep the roster
honest once agents start making agents.
"""

from __future__ import annotations

import pytest

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.models import Agent, AgentKind, AgentLifetime, AgentStatus
from invana.apps.agents.schemas import AgentCreate
from invana.apps.work.managers import TaskManager
from invana.apps.work.models import TaskStatus
from invana.apps.work.schemas import TaskCreate
from invana.core.errors import ConflictError
from invana.runtime.delegation import BoundExceeded, narrow, spawn
from invana.runtime.managers import AgentLifecycleManager
from invana.runtime.models import TaskRun

tasks = TaskManager()

pytestmark = pytest.mark.asyncio


class TestSeeding:
    async def test_an_atlas_is_born_with_a_roster_and_a_default(self, session, graph):
        created = await AgentManager().seed_agents(session, graph=graph)
        await session.flush()
        assert {a.key for a in created} == {"explorer", "ql-query", "modeller", "coordinator"}
        assert graph.default_agent_id is not None

    async def test_only_the_coordinator_may_delegate(self, session, graph):
        """Delegation is expensive — one question becoming four — so exactly one
        seeded agent allows it, and it is not the default (delegation.md DG1)."""
        created = await AgentManager().seed_agents(session, graph=graph)
        await session.flush()

        by_key = {a.key: a for a in created}
        delegating = {key for key, agent in by_key.items() if "delegate" in (agent.workflow_spec.get("allow") or [])}
        assert delegating == {"coordinator"}
        # And its bounds come from the registry, enforced by the interpreter (DG2).
        assert by_key["coordinator"].budget == {"max_depth": 2, "max_children": 3}
        assert graph.default_agent_id != by_key["coordinator"].id

    async def test_seeding_twice_adds_nothing(self, session, graph):
        await AgentManager().seed_agents(session, graph=graph)
        await session.flush()
        again = await AgentManager().seed_agents(session, graph=graph)
        assert again == []

    async def test_the_modeller_surface_never_gets_the_explorer(self, session, graph, agent):
        modeller = await AgentManager().default_agent_for_surface(session, graph=graph, surface="modeller")
        assert modeller.key == "modeller"


class TestLifecycle:
    async def test_pausing_blocks_the_agents_open_tasks(self, session, graph, user, agent):
        task = await tasks.create(session, graph=graph, payload=TaskCreate(title="Work", body="do it"), actor=user)
        await tasks.assign(session, graph=graph, task=task, assignee_kind="agent", assignee_id=agent.id, actor=user)
        await session.flush()
        await AgentManager().set_status(session, agent=agent, status=AgentStatus.paused, actor=user)
        await session.flush()
        assert task.status == TaskStatus.blocked.value

    async def test_retire_keeps_the_row_so_the_trace_still_resolves(self, session, graph, user, agent):
        await AgentManager().retire_agent(session, agent=agent, actor=user)
        await session.flush()
        assert agent.status == AgentStatus.retired.value
        assert await session.get(Agent, agent.id) is not None

    async def test_the_retire_preview_names_the_open_tasks(self, session, graph, user, agent):
        task = await tasks.create(
            session, graph=graph, payload=TaskCreate(title="Supplier review", body="x"), actor=user
        )
        await tasks.assign(session, graph=graph, task=task, assignee_kind="agent", assignee_id=agent.id, actor=user)
        await session.flush()
        preview = await AgentLifecycleManager().retire_preview(session, agent=agent)
        # A count is not enough to decide with.
        assert preview.open_task_titles == ["Supplier review"]

    async def test_a_seeded_agent_cannot_be_deleted(self, session, graph, user, agent):
        with pytest.raises(ConflictError):
            await AgentLifecycleManager().delete_agent(session, agent=agent, actor=user)

    async def test_an_authored_agent_that_never_thought_can_be_deleted(self, session, graph, user):
        authored = await AgentManager().create_agent(
            session, graph=graph, payload=AgentCreate(name="Supplier Analyst", envelope_from="explorer"), actor=user
        )
        await session.flush()
        # It inherited the Explorer's envelope rather than starting empty — an
        # agent with a blank allow-list can do nothing, which is never meant.
        assert authored.workflow_spec["allow"]
        await AgentLifecycleManager().delete_agent(session, agent=authored, actor=user)
        await session.flush()
        assert await session.get(Agent, authored.id) is None

    async def test_an_agent_that_has_thought_retires_rather_than_deleting(self, session, graph, user):
        authored = await AgentManager().create_agent(
            session, graph=graph, payload=AgentCreate(name="Analyst", envelope_from="explorer"), actor=user
        )
        task = await tasks.create(session, graph=graph, payload=TaskCreate(title="t", body="b"), actor=user)
        await tasks.assign(session, graph=graph, task=task, assignee_kind="agent", assignee_id=authored.id, actor=user)
        await session.flush()
        with pytest.raises(ConflictError) as caught:
            await AgentLifecycleManager().delete_agent(session, agent=authored, actor=user)
        assert "retire it instead" in caught.value.detail

    async def test_a_paused_agent_is_refused_by_the_guard(self, session, graph, agent):
        agent.status = AgentStatus.paused.value
        await session.flush()
        with pytest.raises(ConflictError) as caught:
            await AgentManager().require_available(session, agent_id=agent.id, graph_id=graph.id)
        assert "paused" in caught.value.detail


class TestDelegationBounds:
    async def test_a_child_cannot_widen_its_parents_allow_list(self, agent):
        narrowed = narrow(agent, requested={"allow": ["execute_graph_query", "drop_everything"]})
        assert "drop_everything" not in narrowed["allow"]
        assert "execute_graph_query" in narrowed["allow"]

    async def test_a_childs_depth_allowance_shrinks_by_one(self, agent):
        narrowed = narrow(agent, requested={})
        assert narrowed["budget"]["max_depth"] == agent.effective_budget["max_depth"] - 1

    async def test_a_child_budget_is_capped_at_its_parents(self, agent):
        narrowed = narrow(agent, requested={"budget": {"max_steps": 9_999}})
        assert narrowed["budget"]["max_steps"] == agent.effective_budget["max_steps"]

    async def test_an_agent_without_can_spawn_may_not_spawn(self, session, graph, user, agent):
        task = await tasks.create(session, graph=graph, payload=TaskCreate(title="t", body="b"), actor=user)
        await tasks.assign(session, graph=graph, task=task, assignee_kind="agent", assignee_id=agent.id, actor=user)
        await session.flush()
        run = (await session.execute(_thinkings_for(task.id))).scalars().first()
        with pytest.raises(BoundExceeded):
            await spawn(
                session,
                parent=agent,
                run=run,
                name="Checker",
                instructions="check",
                requested={},
            )

    async def test_a_spawned_child_is_ephemeral_and_cannot_spawn_in_turn(self, session, graph, user, agent):
        agent.policy = {"can_spawn": True}
        task = await tasks.create(session, graph=graph, payload=TaskCreate(title="t", body="b"), actor=user)
        await tasks.assign(session, graph=graph, task=task, assignee_kind="agent", assignee_id=agent.id, actor=user)
        await session.flush()
        run = (await session.execute(_thinkings_for(task.id))).scalars().first()

        child = await spawn(
            session, parent=agent, run=run, name="Sole-source checker", instructions="check", requested={}
        )
        await session.flush()
        assert child.kind == AgentKind.spawned.value
        assert child.lifetime == AgentLifetime.ephemeral.value
        # Bounded agency does not propagate by default.
        assert child.effective_policy["can_spawn"] is False
        assert child.parent_agent_id == agent.id

    async def test_an_ephemeral_child_retires_when_its_task_closes(self, session, graph, user, agent):
        agent.policy = {"can_spawn": True}
        task = await tasks.create(session, graph=graph, payload=TaskCreate(title="t", body="b"), actor=user)
        await tasks.assign(session, graph=graph, task=task, assignee_kind="agent", assignee_id=agent.id, actor=user)
        await session.flush()
        run = (await session.execute(_thinkings_for(task.id))).scalars().first()
        child = await spawn(session, parent=agent, run=run, name="Helper", instructions="", requested={})
        await session.flush()

        await tasks.cancel(session, graph=graph, task=task, actor=user)
        await session.flush()
        assert child.status == AgentStatus.retired.value


class TestLineage:
    async def test_lineage_carries_the_child_the_author_and_the_task(self, session, graph, user, agent):
        agent.policy = {"can_spawn": True}
        task = await tasks.create(session, graph=graph, payload=TaskCreate(title="Trace me", body="b"), actor=user)
        await tasks.assign(session, graph=graph, task=task, assignee_kind="agent", assignee_id=agent.id, actor=user)
        await session.flush()
        run = (await session.execute(_thinkings_for(task.id))).scalars().first()
        await spawn(session, parent=agent, run=run, name="Checker", instructions="", requested={})
        await session.flush()

        lineage = await AgentLifecycleManager().lineage(session, agent=agent)
        kinds = {n.kind for n in lineage.nodes}
        # The first canvas kind whose nodes are heterogeneous (docs/for-developers/modules/agents/features/lineage.md).
        assert kinds >= {"agent", "task"}
        assert any(e.kind == "spawned" for e in lineage.edges)
        assert any(e.kind == "assigned" for e in lineage.edges)


def _thinkings_for(task_id: str):
    from sqlalchemy import select

    return select(TaskRun).where(TaskRun.todo_id == task_id)
