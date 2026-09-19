"""Where a Skill was carried, offered and reported.

Lives in `runtime` rather than `apps/skills` because it reads `run_nodes`:
an app is band 2 and the runtime is band 3, so `apps/skills` may not import it
(migration-plan §3). The runtime importing `apps/agents` and `apps/skills` is
downward, and legal.

`skills_offered` is a fact written by prompt assembly. `reported` is the model
saying it followed the prose. The two are never conflated — that is what the
badge in Studio distinguishes.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.agents.schemas import AgentRead, SkillUsageResponse, SkillUsageStep
from invana.apps.skills.models import Skill
from invana.runtime.querysets import TaskRunQuerySet

# Steps are filtered in Python on a JSON column, so the scan is bounded and the
# page is taken after filtering. Widening this is a query change, not a limit.
_SCAN = 400


class SkillUsageManager:
    querysets = TaskRunQuerySet()
    agents = AgentQuerySet()

    async def for_skill(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        graph_id: str,
        limit: int,
    ) -> SkillUsageResponse:
        carried = await self.agents.bound_to_skill(session, graph_id=graph_id, skill_id=skill.id)
        rows = await self.querysets.recent_for_graph(session, graph_id=graph_id, limit=_SCAN)
        steps = [
            SkillUsageStep(
                run_id=row.parent_run_id,
                step_id=row.id,
                label=row.label,
                task_key=row.task_key,
                reported=skill.id in (row.skills_applied or []),
                finished_at=row.finished_at,
            )
            for row in rows
            if skill.id in (row.skills_offered or [])
        ][:limit]
        return SkillUsageResponse(
            skill_id=skill.id,
            used_by=[AgentRead.model_validate(a) for a in carried],
            recent_steps=steps,
        )
