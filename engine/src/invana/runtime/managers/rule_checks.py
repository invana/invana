"""Checked rules at the acts they name — block, warn or report
(docs/for-developers/modules/skills/features/rules.md).

A rule whose current version carries a **check** is read at the acts that
check's kind names. Two acts are checked today:

=====================  =========================================  ===========================
act                    when                                       rules read
=====================  =========================================  ===========================
``dataset.share``      a dataset's visibility moves to install    the install rules
``dataset.bind``       a version is bound into a Graph            install rules · the Graph's
=====================  =========================================  ===========================

**Every rule is evaluated before anything is written**, so one refusal names
every rule that blocks. A failed ``block`` is 409 and the act writes nothing —
its events included, so the refusal is the record. A failed ``warn`` becomes a
line in the act's ``warnings`` and a ``rule.check`` event; a failed ``report``
is the event only.

Lives in ``runtime`` because it joins ``apps/skills`` (the rules) and
``apps/datasets`` (the subject), and the share act wraps ``DatasetManager``.

Usage::

    checks = RuleCheckManager()
    dataset, warnings = await checks.share(session, dataset=ds, payload=DatasetUpdate(visibility="install"), actor=u)
    warnings = await checks.enforce(session, act=ACT_DATASET_BIND, graph_id=g.id, dataset=ds, version=v, actor=u)
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.managers import ConformanceManager, DatasetManager
from invana.apps.datasets.models import Dataset, DatasetVersion, Visibility
from invana.apps.datasets.schemas import DatasetUpdate
from invana.apps.skills.checks import ACT_DATASET_SHARE, CONFORMS, LICENCE, kinds_at
from invana.apps.skills.managers import RuleManager, refusal_line
from invana.apps.skills.models import Rule
from invana.apps.standards.managers import StandardManager
from invana.apps.standards.models import Enforcement
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events import actions
from invana.core.events.services import emit_event


class RuleCheckManager:
    """Stateless. The session is the first argument of every method."""

    rules = RuleManager()
    datasets = DatasetManager()
    claims = ConformanceManager()
    standards = StandardManager()

    async def applicable(self, session: AsyncSession, *, act: str, graph_id: str | None) -> list[Rule]:
        """The active checked rules an act reads, in assembly order."""
        candidates = await self.rules.install(session, active_only=True)
        if graph_id is not None:
            candidates += await self.rules.invariants(session, graph_id=graph_id, active_only=True)
        kinds = kinds_at(act)
        return [r for r in candidates if r.check is not None and r.check.get("kind") in kinds]

    async def _failure(
        self, session: AsyncSession, *, rule: Rule, dataset: Dataset, version: DatasetVersion
    ) -> str | None:
        """Why *rule*'s check fails for this version — ``None`` when it passes."""
        return await self.failure(session, check=rule.check or {}, dataset=dataset, version=version)

    async def failure(
        self, session: AsyncSession, *, check: dict, dataset: Dataset, version: DatasetVersion
    ) -> str | None:
        """Why *check* fails for this version — ``None`` when it passes."""
        if check.get("kind") == LICENCE:
            allowed = check.get("allowed") or []
            if version.licence.strip().lower() in {a.lower() for a in allowed}:
                return None
            return f"licence {version.licence!r} is not one of {', '.join(allowed)}"
        if check.get("kind") == CONFORMS:
            try:
                standard, _ = await self.standards.get_by_ref(session, ref=check["standard"])
            except (NotFoundError, ConflictError):
                return f"the standard {check['standard']} has no version to conform to"
            claim = await self.claims.claim_of(session, dataset=dataset, standard_id=standard.id)
            if claim is None:
                return f"{dataset.address} does not claim {standard.address}"
            row = await self.claims.score_version(session, version=version, claim=claim)
            minimum = float(check.get("min_score", 1.0))
            if row.score >= minimum:
                return None
            return f"it scores {row.score:.4g} against {standard.address}, below {minimum:.4g}"
        return None

    async def enforce(
        self,
        session: AsyncSession,
        *,
        act: str,
        graph_id: str | None,
        dataset: Dataset,
        version: DatasetVersion,
        actor: User,
    ) -> list[str]:
        """Read every applicable rule; raise on a block, record warns and reports, return the warnings."""
        failed: list[tuple[Rule, str]] = []
        for rule in await self.applicable(session, act=act, graph_id=graph_id):
            reason = await self._failure(session, rule=rule, dataset=dataset, version=version)
            if reason is not None:
                failed.append((rule, reason))

        blocks = [refusal_line(rule, reason) for rule, reason in failed if rule.mode == Enforcement.block]
        if blocks:
            raise ConflictError("blocked by rule — " + "; ".join(blocks))

        warnings: list[str] = []
        subject = f"{dataset.address}@{version.version}"
        for rule, reason in failed:
            if rule.mode == Enforcement.warn:
                warnings.append(f"Rule {refusal_line(rule, reason)}.")
            await emit_event(
                session,
                action=actions.RULE_CHECK,
                target_kind=actions.TARGET_RULE,
                target_id=rule.id,
                graph_id=graph_id,
                actor_id=actor.id,
                details={"act": act, "subject": subject, "mode": rule.mode, "version": rule.version, "reason": reason},
            )
        return warnings

    async def share(
        self, session: AsyncSession, *, dataset: Dataset, payload: DatasetUpdate, actor: User
    ) -> tuple[Dataset, list[str]]:
        """``DatasetManager.update``, with the install rules read when it shares the dataset."""
        warnings: list[str] = []
        sharing = payload.visibility == Visibility.install and dataset.visibility != Visibility.install.value
        if sharing:
            self.datasets.require_owner(dataset, actor, "change it")
            version = await self.datasets.current(session, dataset)
            if version is not None:
                warnings = await self.enforce(
                    session, act=ACT_DATASET_SHARE, graph_id=None, dataset=dataset, version=version, actor=actor
                )
        return await self.datasets.update(session, dataset=dataset, payload=payload, actor=actor), warnings
