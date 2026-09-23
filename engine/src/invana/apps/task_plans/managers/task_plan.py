"""Plan library rules — seeding, exploding a spec into rows, and who carries each entry.

The registry's templates still live in the repo as authored step lists; this is
what turns one into **rows**, which is the form everything downstream reads.
"""

from __future__ import annotations

from collections.abc import Mapping

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.agents.registry import TEMPLATES
from invana.apps.task_plans.dag import materialise
from invana.apps.task_plans.models import PlanOrigin, Task, TaskForm, TaskPlan
from invana.apps.task_plans.querysets import TaskPlanQuerySet


def explode(plan_id: str, steps, *, requires: Mapping[str, tuple[str, ...]] | None = None) -> list[Task]:
    """An authored step list, as :class:`Task` rows with materialised ``depends_on``.

    The materialisation happens **here, once**, rather than on every read: an
    order derived at read time is an order nobody reviewed
    (:func:`invana.apps.task_plans.dag.materialise`).

    ``requires`` is **passed in**, not read: the catalogue is band 3 and this
    module is band 2, so an import of it would be the wrong direction — the
    same reason ``dag_for`` took it as an argument before M2
    (migration-plan §4.1, enforced by ``import-linter``).
    """
    return [
        Task(
            task_plan_id=plan_id,
            key=row["key"],
            step_key=row["step_key"] or None,
            # Every seeded node names a catalogue entry. `composite` and
            # `human` arrive with authoring; a row without a step key would be
            # one of those, and there are none yet.
            form=TaskForm.callable.value,
            title=row["title"],
            args=row["args"],
            ordinal=row["ordinal"],
            depends_on=row["depends_on"],
        )
        for row in materialise(steps, requires=requires)
    ]


class TaskPlanManager:
    task_plans_qs = TaskPlanQuerySet()
    agents_qs = AgentQuerySet()

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[TaskPlan]:
        return await self.task_plans_qs.list_for_graph(session, graph_id=graph_id)

    async def get(self, session: AsyncSession, plan_id: str) -> TaskPlan | None:
        return await self.task_plans_qs.get(session, plan_id)

    async def tasks_for(self, session: AsyncSession, *, plan_id: str) -> list[Task]:
        return await self.task_plans_qs.tasks_for(session, plan_id=plan_id)

    async def ensure_seeded(
        self, session: AsyncSession, *, graph_id: str, requires: Mapping[str, tuple[str, ...]] | None = None
    ) -> None:
        """Load the registry's templates into this graph's library, idempotently.

        ``requires`` comes from the caller for the band reason in
        :func:`explode` — the runtime knows the catalogue; an app may not.
        """
        existing = await self.task_plans_qs.key_versions(session, graph_id=graph_id)
        # A plan **is** its rows, so "already seeded" has to mean *populated*,
        # not merely *present*. Migration 000000000038 carries the library
        # across and drops `spec`, leaving a builtin row with its key, its
        # version and no nodes; matching on identity alone would skip it here
        # and the entry would stay empty for the life of the graph.
        empty = await self.task_plans_qs.plans_without_nodes(session, graph_id=graph_id)
        for template in TEMPLATES.values():
            if (template.key, template.version) in existing:
                if (plan_id := empty.get((template.key, template.version))) is not None:
                    await self.task_plans_qs.add_tasks(session, explode(plan_id, template.steps, requires=requires))
                continue
            plan = await self.task_plans_qs.add(
                session,
                TaskPlan(
                    graph_id=graph_id,
                    key=template.key,
                    version=template.version,
                    name=template.key,
                    description=template.description,
                    kind=template.kind,
                    origin=PlanOrigin.builtin.value,
                    intent=list(template.intents),
                    # What this plan offers a caller that inlines it. Seeded
                    # with the rows, because a row binding `${args.N}` and a
                    # plan that does not declare `N` is a plan that cannot be
                    # read ([LB20](docs/for-developers/modules/workflows/features/the-library.md)).
                    args_schema=dict(template.args_schema),
                    reusable=True,
                    created_by_kind="system",
                ),
            )
            await self.task_plans_qs.add_tasks(session, explode(plan.id, template.steps, requires=requires))

    async def used_by(self, session: AsyncSession, plan: TaskPlan) -> list[Agent]:
        """The agents whose envelope lists this plan.

        An envelope with **no** ``templates`` list permits every template, which
        is what the seeded Explorer relies on — so those agents count too.
        """
        agents = await self.agents_qs.list_active_for_graph(session, graph_id=plan.graph_id)
        return [
            agent
            for agent in agents
            if (templates := (agent.workflow_spec or {}).get("templates")) is None or plan.key in templates
        ]
