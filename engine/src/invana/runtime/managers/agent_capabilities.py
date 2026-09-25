"""What an agent can do — its skills and its callables, as two tables that name
each other ([C12](docs/for-developers/modules/agents/features/author-an-agent.md)).

Band 3 for the reason the bind check is: it reads ``apps/skills``,
``apps/task_plans``, the catalogue and ``task_runs``, and only the runtime may
read all four (migration-plan §3).

**Needs are derived, never typed** (AG15). A skill's needs are the callables its
current version's plan names — the plan's own rows, which already carry any
``uses`` inlined (SK32) — so the table cannot drift from the plan a run reads.
A callable's *needed by* is the same reading turned round, plus the base plans
the envelope lets a Plan step pick.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.envelope import Envelope
from invana.apps.agents.models import Agent
from invana.apps.agents.schemas import AgentCallableRow, AgentSkillRow, AgentSkillsAndCallables
from invana.apps.task_plans.models import Task, TaskForm
from invana.apps.task_plans.querysets import TaskPlanQuerySet
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.catalogue.registry import Bound
from invana.runtime.managers.skill_usage import MIN_OFFERS_TO_READ
from invana.runtime.querysets import TaskRunQuerySet

_BOUND_ORDER = {bound.value: i for i, bound in enumerate(Bound)}


def _needs(tasks: list[Task]) -> list[str]:
    """The callables a plan names, in plan order, each once. A ``human`` node
    is a person, not something the envelope ceilings (SK15)."""
    out: list[str] = []
    for task in sorted(tasks, key=lambda t: t.ordinal):
        if task.form == TaskForm.human.value or not task.step_key:
            continue
        if task.step_key not in out:
            out.append(task.step_key)
    return out


class AgentCapabilitiesManager:
    """Stateless. The session is the first argument of every method."""

    plans_qs = TaskPlanQuerySet()
    runs_qs = TaskRunQuerySet()

    async def read(self, session: AsyncSession, *, agent: Agent) -> AgentSkillsAndCallables:
        envelope = Envelope.from_spec(agent.workflow_spec, effort=agent.effective_effort)
        needed_by: dict[str, list[str]] = {}

        # The base plans the Graph answers asks with, as the envelope names them.
        plan_refs: list[str] = []
        for key in sorted(envelope.templates):
            plan = await self.plans_qs.find_by_key(session, graph_id=agent.graph_id, key=key, version=None)
            if plan is None:
                continue
            ref = f"{plan.key}@{plan.version}"
            plan_refs.append(ref)
            for step_key in _needs(await self.plans_qs.tasks_for(session, plan_id=plan.id)):
                needed_by.setdefault(step_key, []).append(ref)

        skills = sorted(agent.bound_skills or [], key=lambda s: s.name.lower())
        versions = [s.current_version for s in skills if s.current_version is not None]
        tasks_by_plan = await self.plans_qs.tasks_for_plans(session, plan_ids=[v.plan_id for v in versions])

        rows: list[AgentSkillRow] = []
        for skill in skills:
            version = skill.current_version
            if version is None:
                # Nothing published, so nothing is offered and nothing is needed
                # yet (SK21) — the row still says it is bound.
                rows.append(AgentSkillRow(skill_id=skill.id, name=skill.name, version=None, when_to_use="", needs=[]))
                continue
            needs = _needs(tasks_by_plan.get(version.plan_id, []))
            for step_key in needs:
                needed_by.setdefault(step_key, []).append(skill.id)
            plan = await self.plans_qs.get(session, version.plan_id)
            offered, applied = await self._usage(session, agent=agent, version_id=version.id)
            rows.append(
                AgentSkillRow(
                    skill_id=skill.id,
                    name=skill.name,
                    version=version.version,
                    when_to_use=version.when_to_use,
                    needs=needs,
                    uses=[f"{u.get('key')}@{u.get('version')}" for u in (plan.uses if plan else []) or []],
                    missing=[k for k in needs if envelope.allow and k not in envelope.allow],
                    offered=offered,
                    applied=applied,
                    enough_to_read=offered >= MIN_OFFERS_TO_READ,
                )
            )

        def order(step_key: str) -> tuple[int, str]:
            entry = CATALOGUE.get(step_key)
            return (_BOUND_ORDER.get(entry.bound.value, len(_BOUND_ORDER)) if entry else len(_BOUND_ORDER), step_key)

        callables = [
            AgentCallableRow(
                step_key=step_key,
                bound=CATALOGUE[step_key].bound.value if step_key in CATALOGUE else "unknown",
                pinned=envelope.pinned_args(step_key),
                needed_by=needed_by.get(step_key, []),
            )
            for step_key in sorted(envelope.allow, key=order)
        ]
        return AgentSkillsAndCallables(agent_id=agent.id, skills=rows, callables=callables, plans=plan_refs)

    async def _usage(self, session: AsyncSession, *, agent: Agent, version_id: str) -> tuple[int, int]:
        """Offered and applied, for this agent's runs and this version only
        (US3) — the Graph-wide count is the skill's page, not the agent's."""
        for agent_id, offered, applied in await self.runs_qs.skill_version_by_agent(
            session, graph_id=agent.graph_id, version_id=version_id
        ):
            if agent_id == agent.id:
                return offered, applied
        return 0, 0
