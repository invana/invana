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
from invana.apps.skills.querysets import RuleVersionQuerySet
from invana.apps.skills.schemas import (
    OfferedRule,
    RuleCitation,
    RuleCitationsResponse,
    RuleVersionCitations,
)
from invana.runtime.querysets import TaskRunQuerySet


class RuleCitationManager:
    task_runs_qs = TaskRunQuerySet()
    rules = RuleManager()

    async def counts_for(self, session: AsyncSession, *, graph_id: str, rules: list[Rule]) -> dict[str, int]:
        """Citations per rule, for a list surface — one query, not one per row."""
        versions_by_rule = await self.rules.version_ids(session, rules=rules)
        return await self.task_runs_qs.rule_citation_counts(
            session, graph_id=graph_id, versions_by_rule=versions_by_rule
        )

    async def for_rule(self, session: AsyncSession, *, rule: Rule, graph_id: str, limit: int) -> RuleCitationsResponse:
        versions = await self.rules.versions_qs.list_for_rule(session, rule.id)
        by_version = {v.id: (v.version, v.statement) for v in versions}
        version_ids = list(by_version)
        counts = await self.task_runs_qs.rule_citation_counts(
            session, graph_id=graph_id, versions_by_rule={rule.id: version_ids}
        )
        # The other half of RU7's pair: steps that had *any* version of this
        # rule in context. Offered minus cited is *never cited*, which is what
        # the evidence loop reads — and what nothing could say while only one of
        # the two columns was ever queried (RU9).
        offers = await self.task_runs_qs.rule_offer_counts(
            session, graph_id=graph_id, versions_by_rule={rule.id: version_ids}
        )
        # One count per wording, asked of the record rather than tallied from
        # `items` below — that list is a bounded window, and a total taken from
        # a page is a different number wearing the same label (RU10).
        per_version = await self.task_runs_qs.rule_citation_counts(
            session, graph_id=graph_id, versions_by_rule={v: [v] for v in version_ids}
        )
        rows = await self.task_runs_qs.steps_citing(session, graph_id=graph_id, version_ids=version_ids, limit=limit)

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
        return RuleCitationsResponse(
            rule_id=rule.id,
            offered=offers.get(rule.id, 0),
            total=counts.get(rule.id, 0),
            versions=[
                RuleVersionCitations(
                    rule_version_id=v.id,
                    version=v.version,
                    statement=v.statement,
                    published_at=v.published_at,
                    cited=per_version.get(v.id, 0),
                )
                for v in versions
            ],
            items=items,
        )


async def offered_rules(session: AsyncSession, *, steps) -> dict[str, OfferedRule]:
    """``rule_version_id`` → the statement that was offered, and the rule to open.

    One resolve for both halves of [RU7](docs/for-developers/modules/skills/features/rules.md)'s
    pair, over every step of a tree or a trace, so the two surfaces that draw a
    step row ask the same question once each rather than once per row
    ([RU12](docs/for-developers/modules/skills/features/rules.md)).

    A version whose rule has been deleted resolves to nothing, and the caller
    drops it: a step row shows statements, and an id is not one.
    """
    ids: set[str] = set()
    for step in steps:
        ids.update(step.rules_offered or [])
        ids.update(step.rules_cited or [])
    if not ids:
        return {}
    rows = await RuleVersionQuerySet().statements_by_id(session, list(ids))
    return {
        version_id: OfferedRule(rule_id=rule_id, statement=statement)
        for version_id, (rule_id, statement) in rows.items()
    }
