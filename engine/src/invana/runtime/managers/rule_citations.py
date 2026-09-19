"""Where a rule was cited.

Lives in `runtime` for the same reason `skill_usage` does: it reads `task_runs`,
and an app (band 2) may not import the runtime (band 3).

A citation is the model's own claim, resolved to the **version** it was offered
— so rewording a rule, or deactivating it, never rewrites what a past step says
it followed ([RU4 · C5](docs/for-developers/modules/skills/features/rules.md)).
Counts are derived from the record on every read; nothing accumulates on the
rule.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.managers import RuleManager
from invana.apps.skills.models import Rule
from invana.apps.skills.schemas import RuleCitation, RuleCitationsResponse
from invana.runtime.querysets import TaskRunQuerySet


class RuleCitationManager:
    querysets = TaskRunQuerySet()
    rules = RuleManager()

    async def counts_for(self, session: AsyncSession, *, graph_id: str, rules: list[Rule]) -> dict[str, int]:
        """Citations per rule, for a list surface — one query, not one per row."""
        versions_by_rule = await self.rules.version_ids(session, rules=rules)
        return await self.querysets.rule_citation_counts(session, graph_id=graph_id, versions_by_rule=versions_by_rule)

    async def for_rule(self, session: AsyncSession, *, rule: Rule, graph_id: str, limit: int) -> RuleCitationsResponse:
        by_version = await self.rules.statements_by_version(session, rule=rule)
        version_ids = list(by_version)
        counts = await self.querysets.rule_citation_counts(
            session, graph_id=graph_id, versions_by_rule={rule.id: version_ids}
        )
        rows = await self.querysets.steps_citing(session, graph_id=graph_id, version_ids=version_ids, limit=limit)

        items = []
        for row in rows:
            cited = next((i for i in (row.rules_cited or []) if i in by_version), None)
            if cited is None:
                continue
            version, statement = by_version[cited]
            items.append(
                RuleCitation(
                    run_id=row.parent_run_id,
                    step_id=row.id,
                    label=row.label,
                    task_key=row.task_key,
                    rule_version_id=cited,
                    version=version,
                    statement=statement,
                    finished_at=row.finished_at,
                )
            )
        return RuleCitationsResponse(rule_id=rule.id, total=counts.get(rule.id, 0), items=items)
