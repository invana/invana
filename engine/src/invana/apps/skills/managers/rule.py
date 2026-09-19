"""Rule rules — create, publish, reorder, activate, deactivate.

The Python API for Rules (migration-plan §6). A rule is **offered and cited,
never enforced** ([RU5](docs/for-developers/modules/skills/features/rules.md)),
so nothing in this file blocks anything: it authors statements and says which
ones are live.

**Deactivating is not a version** ([RU4](docs/for-developers/modules/skills/features/rules.md)).
``active`` is on the rule, so turning one off stops it being offered and leaves
every version — and every step that cited one — exactly where it was. That is
also why there is no delete.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import Rule, RuleVersion
from invana.apps.skills.querysets import RuleQuerySet, RuleVersionQuerySet
from invana.core.errors import NotFoundError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event


class RuleManager:
    """Stateless. The session is the first argument of every method."""

    querysets = RuleQuerySet()
    versions = RuleVersionQuerySet()

    # ── reading ──────────────────────────────────────────────────────────────

    async def invariants(self, session: AsyncSession, *, graph_id: str, active_only: bool = False) -> list[Rule]:
        return await self.querysets.invariants(session, graph_id=graph_id, active_only=active_only)

    async def working(self, session: AsyncSession, *, project_id: str, active_only: bool = False) -> list[Rule]:
        return await self.querysets.working(session, project_id=project_id, active_only=active_only)

    async def get(self, session: AsyncSession, *, rule_id: str, graph_id: str) -> Rule:
        """A rule in another Graph reads as absent rather than forbidden."""
        rule = await self.querysets.get(session, rule_id)
        if rule is None or rule.graph_id != graph_id:
            raise NotFoundError("Rule not found.")
        return rule

    async def list_versions(self, session: AsyncSession, *, rule: Rule) -> list[RuleVersion]:
        return await self.versions.list_for_rule(session, rule.id)

    async def get_version(self, session: AsyncSession, *, rule: Rule, version: int) -> RuleVersion:
        row = await self.versions.get_by_number(session, rule.id, version)
        if row is None:
            raise NotFoundError(f"Version {version} of this rule not found.")
        return row

    # ── writing ──────────────────────────────────────────────────────────────

    async def create(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        project_id: str | None,
        payload,
        actor_id: str,
    ) -> Rule:
        """The rule and its v1, as one act."""
        order = payload.order
        if order is None:
            order = await self.querysets.next_order(session, graph_id=graph_id, project_id=project_id)

        rule = Rule(graph_id=graph_id, project_id=project_id, order=order, created_by_id=actor_id)
        await self.querysets.add(session, rule)

        version = RuleVersion(rule_id=rule.id, version=1, statement=payload.statement, published_by_id=actor_id)
        await self.versions.add(session, version)
        rule.current_version = version
        await session.flush()

        await emit_event(
            session,
            action=actions.RULE_CREATE,
            target_kind=actions.TARGET_RULE,
            target_id=rule.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"statement": version.statement, "kind": rule.kind, "project_id": project_id},
            trace_id=current_trace_id(),
        )
        return rule

    async def publish(self, session: AsyncSession, *, rule: Rule, statement: str, actor_id: str) -> RuleVersion:
        """Mint the next version and point the rule at it."""
        number = await self.versions.highest_version(session, rule.id) + 1
        version = RuleVersion(rule_id=rule.id, version=number, statement=statement, published_by_id=actor_id)
        await self.versions.add(session, version)
        rule.current_version = version
        await session.flush()

        await emit_event(
            session,
            action=actions.RULE_PUBLISH,
            target_kind=actions.TARGET_RULE,
            target_id=rule.id,
            graph_id=rule.graph_id,
            actor_id=actor_id,
            details={"statement": statement, "version": number},
            trace_id=current_trace_id(),
        )
        return version

    async def update(self, session: AsyncSession, *, rule: Rule, payload, actor_id: str) -> Rule:
        """A reorder edits the row; a rewording publishes the next version."""
        if payload.order is not None and payload.order != rule.order:
            rule.order = payload.order
            await session.flush()

        # Resending the same wording is not a publish: an identical version
        # would restart the citation count for no reason.
        if payload.statement is not None and payload.statement != rule.statement:
            await self.publish(session, rule=rule, statement=payload.statement, actor_id=actor_id)
        return rule

    async def set_active(self, session: AsyncSession, *, rule: Rule, active: bool, actor_id: str) -> Rule:
        """Stop offering it, or start again. Never a delete, never a version."""
        if rule.active == active:
            return rule
        rule.active = active
        await session.flush()
        await emit_event(
            session,
            action=actions.RULE_ACTIVATE if active else actions.RULE_DEACTIVATE,
            target_kind=actions.TARGET_RULE,
            target_id=rule.id,
            graph_id=rule.graph_id,
            actor_id=actor_id,
            details={"statement": rule.statement},
            trace_id=current_trace_id(),
        )
        return rule

    # ── citations ────────────────────────────────────────────────────────────
    # Where a rule was actually used. Read from the record like skill usage, and
    # never accumulated in a counter on the rule.

    async def version_ids(self, session: AsyncSession, *, rules: list[Rule]) -> dict[str, list[str]]:
        """Every published version id, per rule — what a citation can name."""
        out: dict[str, list[str]] = {}
        for rule in rules:
            out[rule.id] = [v.id for v in await self.versions.list_for_rule(session, rule.id)]
        return out

    async def statements_by_version(self, session: AsyncSession, *, rule: Rule) -> dict[str, tuple[int, str]]:
        """``rule_version_id`` → ``(version, statement)``, for resolving citations."""
        return {v.id: (v.version, v.statement) for v in await self.versions.list_for_rule(session, rule.id)}
