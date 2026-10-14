"""Rule rules — create, publish, reorder, activate, deactivate, at three scopes.

The Python API for Rules (docs/for-developers/modules/skills/features/rules.md).
A rule is a statement **offered and cited** by steps; nothing in this file
blocks a run. A rule may also carry a **check** from a closed vocabulary
(``invana.apps.skills.checks``) and a **mode**, which the acts that check names
read — that reading is ``runtime.managers.RuleCheckManager``'s, not this file's.

**Three scopes, read off two columns**: an ``install`` rule has no Graph and is
an install Admin's to write (``users.is_superuser`` until roles land); a
``graph`` rule is a Graph's invariant; a ``project`` rule is a working rule.
A Graph route never reads an install rule by id — it reads as absent there.

**Deactivating is not a version.** ``active`` is on the rule, so turning one off
stops it being offered and checked and leaves every version — and every step
that cited one — exactly where it was. That is also why there is no delete.
The statement, the check and the mode are the wording: changing any of them
publishes the next version.

Usage::

    rules = RuleManager()
    rule = await rules.create_install(session, payload=RuleCreate(statement="…", check=…, mode="block"), actor=admin)
    rule = await rules.create(session, graph_id=g.id, project_id=None, payload=RuleCreate(statement="…"), actor_id=u.id)
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.checks import normalise_check
from invana.apps.skills.models import Rule, RuleVersion
from invana.apps.skills.querysets import RuleQuerySet, RuleVersionQuerySet
from invana.apps.standards.managers import StandardManager
from invana.apps.standards.models import Enforcement
from invana.core.auth.models import User
from invana.core.errors import NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event


def _scope(graph_id: str | None, project_id: str | None) -> str:
    if project_id:
        return "project"
    return "graph" if graph_id else "install"


class RuleManager:
    """Stateless. The session is the first argument of every method."""

    rules_qs = RuleQuerySet()
    versions_qs = RuleVersionQuerySet()
    standards = StandardManager()

    @staticmethod
    def require_install_admin(actor: User) -> None:
        if not actor.is_superuser:
            raise PermissionDeniedError("Only an install Admin writes an install rule.")

    # ── reading ──────────────────────────────────────────────────────────────

    async def install(self, session: AsyncSession, *, active_only: bool = False) -> list[Rule]:
        return await self.rules_qs.install(session, active_only=active_only)

    async def invariants(self, session: AsyncSession, *, graph_id: str, active_only: bool = False) -> list[Rule]:
        return await self.rules_qs.invariants(session, graph_id=graph_id, active_only=active_only)

    async def working(self, session: AsyncSession, *, project_id: str, active_only: bool = False) -> list[Rule]:
        return await self.rules_qs.working(session, project_id=project_id, active_only=active_only)

    async def get(self, session: AsyncSession, *, rule_id: str, graph_id: str) -> Rule:
        """A rule in another Graph, or an install rule, reads as absent rather than forbidden."""
        rule = await self.rules_qs.get(session, rule_id)
        if rule is None or rule.graph_id != graph_id:
            raise NotFoundError("Rule not found.")
        return rule

    async def get_install(self, session: AsyncSession, *, rule_id: str) -> Rule:
        rule = await self.rules_qs.get(session, rule_id)
        if rule is None or rule.graph_id is not None:
            raise NotFoundError("Rule not found.")
        return rule

    async def list_versions(self, session: AsyncSession, *, rule: Rule) -> list[RuleVersion]:
        return await self.versions_qs.list_for_rule(session, rule.id)

    async def get_version(self, session: AsyncSession, *, rule: Rule, version: int) -> RuleVersion:
        row = await self.versions_qs.get_by_number(session, rule.id, version)
        if row is None:
            raise NotFoundError(f"Version {version} of this rule not found.")
        return row

    # ── the check ────────────────────────────────────────────────────────────

    async def _check_and_mode(
        self, session: AsyncSession, *, check: Any, mode: Any, scope: str
    ) -> tuple[dict[str, Any] | None, str | None]:
        """The stored check and mode, validated for *scope*. A mode alone is refused."""
        if check is None:
            if mode is not None:
                raise ValidationError("A mode says what a failed check does — this rule has no check.")
            return None, None
        raw = check.model_dump(exclude_none=True) if hasattr(check, "model_dump") else dict(check)
        stored = normalise_check(raw, scope=scope)
        if "standard" in stored:
            await self.standards.get_by_ref(session, ref=stored["standard"])
        return stored, Enforcement(mode or Enforcement.warn).value

    # ── writing ──────────────────────────────────────────────────────────────

    async def create(
        self,
        session: AsyncSession,
        *,
        graph_id: str | None,
        project_id: str | None,
        payload,
        actor_id: str,
    ) -> Rule:
        """The rule and its v1, as one act."""
        check, mode = await self._check_and_mode(
            session, check=payload.check, mode=payload.mode, scope=_scope(graph_id, project_id)
        )
        order = payload.order
        if order is None:
            order = await self.rules_qs.next_order(session, graph_id=graph_id, project_id=project_id)

        rule = Rule(graph_id=graph_id, project_id=project_id, order=order, created_by_id=actor_id)
        await self.rules_qs.add(session, rule)

        version = RuleVersion(
            rule_id=rule.id, version=1, statement=payload.statement, check=check, mode=mode, published_by_id=actor_id
        )
        await self.versions_qs.add(session, version)
        rule.current_version = version
        await session.flush()

        await emit_event(
            session,
            action=actions.RULE_CREATE,
            target_kind=actions.TARGET_RULE,
            target_id=rule.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={
                "statement": version.statement,
                "scope": rule.scope,
                "kind": rule.kind,
                "project_id": project_id,
                "check": check,
                "mode": mode,
            },
        )
        return rule

    async def create_install(self, session: AsyncSession, *, payload, actor: User) -> Rule:
        """An install rule — offered in every Graph, written by an install Admin."""
        self.require_install_admin(actor)
        return await self.create(session, graph_id=None, project_id=None, payload=payload, actor_id=actor.id)

    async def publish(
        self,
        session: AsyncSession,
        *,
        rule: Rule,
        statement: str,
        actor_id: str,
        why: str | None = None,
        check: dict[str, Any] | None = None,
        mode: str | None = None,
    ) -> RuleVersion:
        """Mint the next version and point the rule at it."""
        number = await self.versions_qs.highest_version(session, rule.id) + 1
        version = RuleVersion(
            rule_id=rule.id, version=number, statement=statement, check=check, mode=mode, published_by_id=actor_id
        )
        await self.versions_qs.add(session, version)
        rule.current_version = version
        await session.flush()

        await emit_event(
            session,
            action=actions.RULE_PUBLISH,
            target_kind=actions.TARGET_RULE,
            target_id=rule.id,
            graph_id=rule.graph_id,
            actor_id=actor_id,
            details={"statement": statement, "version": number, "why": why, "check": check, "mode": mode},
        )
        return version

    async def update(self, session: AsyncSession, *, rule: Rule, payload, actor_id: str) -> Rule:
        """A reorder edits the row; a new statement, check or mode publishes the next version."""
        if payload.order is not None and payload.order != rule.order:
            rule.order = payload.order
            await session.flush()

        sent = payload.model_fields_set
        statement = payload.statement if payload.statement is not None else rule.statement
        if "check" in sent or "mode" in sent:
            check_in = payload.check if "check" in sent else rule.check
            mode_in = payload.mode if "mode" in sent else (rule.mode if check_in is not None else None)
            check, mode = await self._check_and_mode(session, check=check_in, mode=mode_in, scope=rule.scope)
        else:
            check, mode = rule.check, rule.mode

        # Resending the same wording is not a publish: an identical version
        # would restart the citation count for no reason.
        if (statement, check, mode) != (rule.statement, rule.check, rule.mode):
            await self.publish(
                session, rule=rule, statement=statement, actor_id=actor_id, why=payload.why, check=check, mode=mode
            )
        return rule

    async def update_install(self, session: AsyncSession, *, rule_id: str, payload, actor: User) -> Rule:
        self.require_install_admin(actor)
        rule = await self.get_install(session, rule_id=rule_id)
        return await self.update(session, rule=rule, payload=payload, actor_id=actor.id)

    async def set_active(self, session: AsyncSession, *, rule: Rule, active: bool, actor_id: str) -> Rule:
        """Stop offering and checking it, or start again. Never a delete, never a version."""
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
        )
        return rule

    async def set_install_active(self, session: AsyncSession, *, rule_id: str, active: bool, actor: User) -> Rule:
        self.require_install_admin(actor)
        rule = await self.get_install(session, rule_id=rule_id)
        return await self.set_active(session, rule=rule, active=active, actor_id=actor.id)

    # ── citations ────────────────────────────────────────────────────────────
    # Where a rule was actually used. Read from the record like skill usage, and
    # never accumulated in a counter on the rule.

    async def version_ids(self, session: AsyncSession, *, rules: list[Rule]) -> dict[str, list[str]]:
        """Every published version id, per rule — what a citation can name."""
        out: dict[str, list[str]] = {}
        for rule in rules:
            out[rule.id] = [v.id for v in await self.versions_qs.list_for_rule(session, rule.id)]
        return out

    async def statements_by_version(self, session: AsyncSession, *, rule: Rule) -> dict[str, tuple[int, str]]:
        """``rule_version_id`` → ``(version, statement)``, for resolving citations."""
        return {v.id: (v.version, v.statement) for v in await self.versions_qs.list_for_rule(session, rule.id)}
