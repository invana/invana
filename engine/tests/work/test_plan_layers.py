"""What a plan **declares**, and who calls it
([LB19](docs/for-developers/modules/workflows/features/the-library.md) ·
[LB22](docs/for-developers/modules/workflows/features/the-library.md)).

Two claims, and the negative half of each is the point:

* every governed band is sent, **touched or not** — *this plan leaves the graph
  alone* is the fact a reader is checking for, and a band that vanished when
  empty would be indistinguishable from one that failed to load;
* *used by* means **inlined**, not *permitted* — an agent whose envelope lists a
  plan may run it and has not used it, and the panel answers the two in
  different sections because they are different questions.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.models import Skill, SkillVersion
from invana.apps.task_plans.models import Task, TaskForm, TaskPlan
from invana.runtime.layers import declared_bands
from invana.runtime.managers import TaskPlanRunsManager


def _task(key: str, *, step_key: str | None, form: str = TaskForm.callable.value) -> Task:
    return Task(task_plan_id="p1", key=key, step_key=step_key, form=form)


class TestDeclaredBands:
    def test_a_plan_declares_the_bands_its_steps_spend(self):
        bands = {
            b["layer"]: b
            for b in declared_bands(
                [
                    _task("translate", step_key="translate_thought"),
                    _task("execute", step_key="execute_graph_query"),
                    _task("sign_off", step_key=None, form=TaskForm.human.value),
                ]
            )
        }
        assert bands["llm"]["declared"] and bands["llm"]["summary"] == "1 step"
        assert bands["graph data"]["declared"]
        assert bands["human"]["summary"] == "1 step"

    def test_an_untouched_band_is_still_sent_and_reads_as_nothing(self):
        """The negative half: `—`, never `0 steps` and never an absent row."""
        bands = {b["layer"]: b for b in declared_bands([_task("check", step_key="validate_query")])}
        # Five governed bands, always — the spine is not one of them.
        assert set(bands) == {"graph data", "llm", "third party", "cache", "human"}
        assert bands["third party"] == {
            "layer": "third party",
            "declared": False,
            "steps": 0,
            "summary": "—",
        }
        # `validate_query` spends nothing, so it lands on the spine and no
        # governed band claims it.
        assert not any(b["declared"] for b in bands.values())


@pytest.mark.asyncio
class TestCallers:
    async def test_a_skills_plan_that_inlines_one_is_a_caller_with_what_it_tuned(
        self, session: AsyncSession, graph: Graph
    ):
        library = TaskPlanRunsManager()
        plan = TaskPlan(graph_id=graph.id, key="escalate-core", version=2, reusable=True)
        session.add(plan)
        await session.flush()
        session.add(Task(task_plan_id=plan.id, key="fetch", step_key="execute_graph_query"))

        # The caller: a skill version's plan, which is `reusable = False` and so
        # is never in the library it calls into (LB16).
        caller = TaskPlan(
            graph_id=graph.id,
            key=None,
            reusable=False,
            uses=[{"key": "escalate-core", "version": 2, "args": {"grace_days": 2}}],
        )
        skill = Skill(graph_id=graph.id, name="Escalate a late supplier")
        session.add_all([caller, skill])
        await session.flush()
        session.add(SkillVersion(skill_id=skill.id, version=1, plan_id=caller.id))
        await session.flush()

        detail = await library.detail(session, workflow=plan)
        assert [(c.kind, c.name, c.args) for c in detail.callers] == [
            ("skill", "Escalate a late supplier", {"grace_days": 2})
        ]
        assert detail.caller_count == 1

    async def test_an_agent_permitted_to_run_it_is_not_a_caller(self, session: AsyncSession, graph: Graph, agent):
        """*May run* and *used by* are different facts, and only one is a use."""
        library = TaskPlanRunsManager()
        plan = TaskPlan(graph_id=graph.id, key="nl-single", version=1, reusable=True)
        session.add(plan)
        await session.flush()
        session.add(Task(task_plan_id=plan.id, key="translate", step_key="translate_thought"))
        await session.flush()

        detail = await library.detail(session, workflow=plan)
        assert detail.used_by, "the seeded agents may run it"
        assert detail.callers == []
        assert detail.caller_count == 0
