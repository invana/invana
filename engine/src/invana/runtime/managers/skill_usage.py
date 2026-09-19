"""Where a Skill was carried, offered and reported.

Lives in `runtime` rather than `apps/skills` because it reads `task_runs`:
an app is band 2 and the runtime is band 3, so `apps/skills` may not import it
(migration-plan §3). The runtime importing `apps/agents` and `apps/skills` is
downward, and legal.

`skills_offered` is a fact written by prompt assembly. `reported` is the model
saying it followed the prose. The two are never conflated — that is what the
badge in Studio distinguishes.

**Everything here is per version.** A step records the version it was offered
(SK3), so a count belongs to one published text: *offered 40, applied 31* is a
claim about v3, and v4 starts its own ([US3](docs/for-developers/modules/skills/features/usage.md)).
Nothing is accumulated in a counter — the numbers are derived from the record on
every read (US2).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.agents.schemas import (
    AgentRead,
    SkillUsageByAgent,
    SkillUsageByOutcome,
    SkillUsageResponse,
    SkillUsageStep,
    SkillUsageVersion,
)
from invana.apps.skills.managers import SkillBindingManager
from invana.apps.skills.models import Skill
from invana.apps.skills.querysets import SkillVersionQuerySet
from invana.runtime.querysets import TaskRunQuerySet

# The *step list* is filtered in Python on a JSON column, so the scan is bounded
# and the page is taken after filtering. The counts above it are not: they are
# SQL over the whole Graph, because a total taken from a window is not a total.
# Widening this is a query change, not a limit.
_SCAN = 400

#: Below this many offers, a ratio says more than it knows: *offered 3, applied
#: 1* is three runs, not 33%. The floor lives here so the API, the CLI and Studio
#: all say *too few to read* at the same point (US6).
MIN_OFFERS_TO_READ = 5


def _readable(offered: int) -> bool:
    return offered >= MIN_OFFERS_TO_READ


class SkillUsageManager:
    querysets = TaskRunQuerySet()
    agents = AgentQuerySet()
    versions = SkillVersionQuerySet()
    bindings = SkillBindingManager()

    async def for_skill(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        graph_id: str,
        limit: int,
    ) -> SkillUsageResponse:
        published = await self.versions.list_for_skill(session, skill.id)
        version_of = {v.id: v.version for v in published}

        counts = []
        for version in published:
            offered, applied = await self.querysets.skill_version_counts(
                session, graph_id=graph_id, version_id=version.id
            )
            counts.append(
                SkillUsageVersion(
                    skill_version_id=version.id,
                    version=version.version,
                    offered=offered,
                    applied=applied,
                    gap=offered - applied,
                    enough_to_read=_readable(offered),
                )
            )

        bound_to = await self.bindings.agent_ids_for_skill(session, skill_id=skill.id)
        carried = await self.agents.by_ids(session, graph_id=graph_id, ids=bound_to)

        by_agent, by_outcome = await self._breakdowns(session, graph_id=graph_id, version_id=skill.current_version_id)

        rows = await self.querysets.recent_nodes_for_graph(session, graph_id=graph_id, limit=_SCAN)
        steps = []
        for row in rows:
            # The version of *this* skill the step was offered. A step carries
            # several skills, and only one of them is the one being read.
            offered_id = next((i for i in (row.skills_offered or []) if i in version_of), None)
            if offered_id is None:
                continue
            steps.append(
                SkillUsageStep(
                    run_id=row.parent_run_id,
                    step_id=row.id,
                    label=row.label,
                    task_key=row.task_key,
                    skill_version_id=offered_id,
                    version=version_of[offered_id],
                    reported=offered_id in (row.skills_applied or []),
                    finished_at=row.finished_at,
                )
            )
            if len(steps) == limit:
                break

        return SkillUsageResponse(
            skill_id=skill.id,
            current_version_id=skill.current_version_id,
            versions=counts,
            by_agent=by_agent,
            by_outcome=by_outcome,
            used_by=[AgentRead.model_validate(a) for a in carried],
            recent_steps=steps,
        )

    async def _breakdowns(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        version_id: str | None,
    ) -> tuple[list[SkillUsageByAgent], list[SkillUsageByOutcome]]:
        """The current version's two cuts. Never summed across versions."""
        if version_id is None:
            return [], []

        agent_rows = await self.querysets.skill_version_by_agent(session, graph_id=graph_id, version_id=version_id)
        names = await self.agents.names_by_ids(session, [a for a, _, _ in agent_rows if a])
        by_agent = [
            SkillUsageByAgent(
                agent_id=agent_id,
                agent_name=names.get(agent_id) if agent_id else None,
                offered=offered,
                applied=applied,
                gap=offered - applied,
                enough_to_read=_readable(offered),
            )
            for agent_id, offered, applied in agent_rows
        ]

        outcome_rows = await self.querysets.skill_version_by_outcome(session, graph_id=graph_id, version_id=version_id)
        by_outcome = [
            SkillUsageByOutcome(
                outcome=outcome,
                offered=offered,
                applied=applied,
                gap=offered - applied,
                enough_to_read=_readable(offered),
            )
            for outcome, offered, applied in outcome_rows
        ]
        return by_agent, by_outcome
