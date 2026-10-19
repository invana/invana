"""Decisions — a person's verdict and decision on a branch, checked by the rules
(docs/for-developers/modules/work/features/branches-and-decisions.md).

Deciding is the one act in a project the rules read. Before anything is
written:

1. every finding cited and addressed must be on the branch;
2. the verdict must address every ``contradicts`` finding on the branch;
3. a decided branch takes a new decision only as one that **supersedes** its
   current one, citing a finding added after it — decisions are append-only;
4. a ``merge`` names another open branch of the same project;
5. every active rule whose check reads ``project.decide`` — install, Graph and
   project scope — is evaluated against the cited findings. A failed ``block``
   refuses the act with 409 naming each rule and the evidence that broke it, and
   nothing is written, events included. A failed ``warn`` is a line in the
   decision's ``warnings``; ``warn`` and ``report`` failures each emit
   ``rule.check``.

Then the decision is written with the rules it was checked against, the branch
takes the status the decision names, and a merge links the carried findings
into its target.

Usage::

    decisions = DecisionManager()
    decision = await decisions.decide(session, project=p, branch=b, payload=DecisionCreate(...), actor=u)
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.managers import DatasetManager
from invana.apps.skills.checks import ACT_PROJECT_DECIDE, NOT_RETRACTED, REVIEWED, kinds_at
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.models import Rule
from invana.apps.standards.models import Enforcement
from invana.apps.work.managers.branch import BranchManager
from invana.apps.work.managers.project import ProjectManager
from invana.apps.work.models import (
    CLOSED_BRANCH_STATUSES,
    STATUS_AFTER,
    Choice,
    FindingVia,
    Project,
    ProjectBranch,
    ProjectDecision,
    ProjectFinding,
    Stance,
)
from invana.apps.work.project_types import vocabulary
from invana.apps.work.querysets import (
    BranchFindingQuerySet,
    ProjectBranchQuerySet,
    ProjectDecisionQuerySet,
    ProjectFindingQuerySet,
    ProjectQuerySet,
)
from invana.apps.work.schemas import DecisionCheck, DecisionCreate, DecisionRead
from invana.core.auth.models import User
from invana.core.errors import ConflictError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event


def _names(findings: list[ProjectFinding]) -> str:
    return ", ".join(f"f{f.number}" for f in findings)


class DecisionManager:
    """Stateless. The session is the first argument of every method."""

    decisions_qs = ProjectDecisionQuerySet()
    branches_qs = ProjectBranchQuerySet()
    findings_qs = ProjectFindingQuerySet()
    links_qs = BranchFindingQuerySet()
    projects_qs = ProjectQuerySet()
    projects = ProjectManager()
    branches = BranchManager()
    rules = RuleManager()
    datasets = DatasetManager()

    # ── reading ──────────────────────────────────────────────────────────────

    async def list_for_branch(self, session: AsyncSession, *, project: Project, branch: ProjectBranch):
        return await self.read(session, await self.decisions_qs.list_for_branch(session, branch_id=branch.id))

    async def list_for_graph(
        self, session: AsyncSession, *, graph_id: str, reader_id: str | None, project: Project | None = None
    ) -> list[DecisionRead]:
        """Every decision in a Graph the reader may see, newest first."""
        hidden = await self.projects.hidden_ids(session, graph_id=graph_id, reader_id=reader_id)
        rows = await self.decisions_qs.list_for_graph(
            session, graph_id=graph_id, exclude_project_ids=hidden, project_id=project.id if project else None
        )
        return await self.read(session, rows)

    @staticmethod
    def count_current(decisions: list[DecisionRead]) -> int:
        """How many of a listed set of decisions are current.

        A decision is current while no later decision supersedes it; decisions
        are append-only, so a superseded one stays recorded and stops counting.
        The list header reads *2 current · 5 recorded* from this and ``total``.
        """
        return sum(1 for d in decisions if d.superseded_by_number is None)

    async def read(self, session: AsyncSession, decisions: list[ProjectDecision]) -> list[DecisionRead]:
        """Decisions with every id turned into the number a person types, and the type's words."""
        branch_numbers = await self.branches_qs.numbers_by_ids(
            session, [d.branch_id for d in decisions] + [d.into_branch_id or "" for d in decisions]
        )
        finding_ids = [i for d in decisions for i in (*d.cites, *d.addresses)]
        finding_numbers = {f.id: f.number for f in await self.findings_qs.by_ids(session, finding_ids)}
        decision_numbers = await self.decisions_qs.numbers_by_ids(session, [d.supersedes_id or "" for d in decisions])
        superseded_by = await self.decisions_qs.superseded_by(session, [d.id for d in decisions])
        projects: dict[str, Project] = {}
        out: list[DecisionRead] = []
        for decision in decisions:
            if decision.project_id not in projects:
                projects[decision.project_id] = await self.projects_qs.get(session, decision.project_id)
            project = projects[decision.project_id]
            words = vocabulary(project.type if project else "general")
            stored = ("id", "project_id", "number", "verdict", "choice", "rationale", "checks", "warnings")
            read = DecisionRead.model_validate(
                {f: getattr(decision, f) for f in (*stored, "decided_by_id", "created_at")}
                | {
                    "project_key": project.key if project else None,
                    "branch_number": branch_numbers.get(decision.branch_id),
                    "verdict_label": words.verdicts.get(decision.verdict),
                    "choice_label": words.choices.get(decision.choice),
                    "cites": [finding_numbers[i] for i in decision.cites if i in finding_numbers],
                    "addresses": [finding_numbers[i] for i in decision.addresses if i in finding_numbers],
                    "into_number": branch_numbers.get(decision.into_branch_id or ""),
                    "supersedes_number": decision_numbers.get(decision.supersedes_id or ""),
                    "superseded_by_number": superseded_by.get(decision.id),
                }
            )
            out.append(read)
        return out

    # ── the rules ────────────────────────────────────────────────────────────

    async def applicable(self, session: AsyncSession, *, project: Project) -> list[Rule]:
        """The active rules whose check reads ``project.decide``, in assembly order."""
        candidates = await self.rules.install(session, active_only=True)
        candidates += await self.rules.invariants(session, graph_id=project.graph_id, active_only=True)
        candidates += await self.rules.working(session, project_id=project.id, active_only=True)
        kinds = kinds_at(ACT_PROJECT_DECIDE)
        return [r for r in candidates if r.check is not None and r.check.get("kind") in kinds]

    async def _failure(self, session: AsyncSession, *, rule: Rule, cited: list[ProjectFinding]) -> str | None:
        """Which cited evidence breaks *rule* — ``None`` when it passes."""
        kind = (rule.check or {}).get("kind")
        if kind == REVIEWED:
            unreviewed = [f for f in cited if f.reviewed_by_id is None]
            if unreviewed:
                return f"{_names(unreviewed)} not reviewed by a person — review them, or remove them from the cites"
            return None
        if kind == NOT_RETRACTED:
            by_version: dict[str, list[ProjectFinding]] = {}
            for finding in cited:
                for cite in finding.cites:
                    if cite.get("kind") == "dataset" and cite.get("version_id"):
                        by_version.setdefault(cite["version_id"], []).append(finding)
            versions = await self.datasets.versions_qs.by_ids(session, list(by_version))
            retracted = [v for v in versions if v.retracted_at is not None]
            if not retracted:
                return None
            refs = await self.datasets.addresses(session, [v.id for v in retracted])
            broken = sorted({f.number for v in retracted for f in by_version[v.id]})
            return (
                f"f{', f'.join(map(str, broken))} cite retracted {', '.join(sorted(refs.values()))} — "
                "remove them from the cites, or send them for review"
            )
        return None

    async def _check(
        self, session: AsyncSession, *, project: Project, cited: list[ProjectFinding]
    ) -> list[tuple[Rule, str | None]]:
        """Every applicable rule with why it fails, raising when one blocks."""
        results = [
            (rule, await self._failure(session, rule=rule, cited=cited))
            for rule in await self.applicable(session, project=project)
        ]
        blocks = [
            f'"{rule.statement}": {reason}'
            for rule, reason in results
            if reason is not None and rule.mode == Enforcement.block
        ]
        if blocks:
            raise ConflictError("blocked by rule — " + "; ".join(blocks))
        return results

    # ── deciding ─────────────────────────────────────────────────────────────

    async def _numbered(
        self, linked: dict[int, ProjectFinding], numbers: list[int], what: str, branch: ProjectBranch
    ) -> list[ProjectFinding]:
        missing = [n for n in numbers if n not in linked]
        if missing:
            raise ValidationError(
                f"{what} f{', f'.join(map(str, missing))}, which {'is' if len(missing) == 1 else 'are'} "
                f"not on branch {branch.number}."
            )
        return [linked[n] for n in numbers]

    async def decide(
        self,
        session: AsyncSession,
        *,
        project: Project,
        branch: ProjectBranch,
        payload: DecisionCreate,
        actor: User,
    ) -> ProjectDecision:
        """Record a verdict and a decision on *branch*, checked by every rule in force."""
        self.projects.require_writable(project)
        linked = {f.number: f for f, _ in await self.links_qs.findings_of(session, branch_id=branch.id)}

        cited = await self._numbered(
            linked, payload.cites if payload.cites is not None else sorted(linked), "It cites", branch
        )
        addressed = await self._numbered(linked, payload.addresses, "It addresses", branch)
        unaddressed = [
            f for f in linked.values() if f.stance == Stance.contradicts and f.id not in {a.id for a in addressed}
        ]
        if unaddressed:
            raise ValidationError(
                f"The verdict must address every contradicting finding — {_names(unaddressed)} "
                f"{'is' if len(unaddressed) == 1 else 'are'} not addressed."
            )

        current = await self.decisions_qs.current_for(session, branch_id=branch.id)
        supersedes: ProjectDecision | None = None
        if current is not None:
            if payload.supersedes != current.number:
                raise ConflictError(
                    f"Branch {branch.number} has decision d{current.number}. Decisions are never edited — "
                    f"record a new one that supersedes d{current.number}."
                )
            if not any(f.created_at > current.created_at for f in cited):
                raise ValidationError(
                    f"A decision that supersedes d{current.number} cites evidence added after it — "
                    "add the new finding first."
                )
            supersedes = current
        elif payload.supersedes is not None:
            raise ValidationError(f"Branch {branch.number} has no decision for d{payload.supersedes} to supersede.")

        into: ProjectBranch | None = None
        carried: list[ProjectFinding] = []
        if payload.choice == Choice.merge:
            if payload.into is None:
                raise ValidationError("A merge names the branch it merges into.")
            into = await self.branches.get(session, project=project, number=payload.into)
            if into.id == branch.id:
                raise ValidationError("A branch cannot merge into itself.")
            if into.status in CLOSED_BRANCH_STATUSES:
                raise ValidationError(f"Branch {into.number} is {into.status}; merge into an open one.")
            carry = payload.carry if payload.carry is not None else sorted(linked)
            carried = await self._numbered(linked, carry, "It carries", branch)
        elif payload.into is not None or payload.carry is not None:
            raise ValidationError("Only a merge names a branch to merge into and findings to carry.")

        results = await self._check(session, project=project, cited=cited)

        warnings = [
            f'Rule "{rule.statement}": {reason}.'
            for rule, reason in results
            if reason is not None and rule.mode == Enforcement.warn
        ]
        checks = [
            DecisionCheck(
                rule_id=rule.id,
                version=rule.version,
                statement=rule.statement,
                mode=rule.mode or "",
                passed=reason is None,
                reason=reason,
            ).model_dump()
            for rule, reason in results
        ]
        decision = ProjectDecision(
            project_id=project.id,
            branch_id=branch.id,
            number=await self.decisions_qs.next_number(session, project_id=project.id),
            verdict=payload.verdict,
            choice=payload.choice,
            rationale=payload.rationale,
            cites=[f.id for f in cited],
            addresses=[f.id for f in addressed],
            into_branch_id=into.id if into else None,
            supersedes_id=supersedes.id if supersedes else None,
            checks=checks,
            warnings=warnings,
            decided_by_id=actor.id,
        )
        await self.decisions_qs.add(session, decision)

        branch.status = STATUS_AFTER[payload.choice]
        branch.merged_into_id = into.id if into else None
        if into is not None:
            await self.links_qs.link(
                session, branch_id=into.id, finding_ids=[f.id for f in carried], via=FindingVia.merge
            )
        await session.flush()

        subject = f"{project.key}/b{branch.number}/d{decision.number}"
        for rule, reason in results:
            if reason is None:
                continue
            await emit_event(
                session,
                action=actions.RULE_CHECK,
                target_kind=actions.TARGET_RULE,
                target_id=rule.id,
                graph_id=project.graph_id,
                project_id=project.id,
                actor_id=actor.id,
                details={
                    "act": ACT_PROJECT_DECIDE,
                    "subject": subject,
                    "mode": rule.mode,
                    "version": rule.version,
                    "reason": reason,
                },
            )
        await emit_event(
            session,
            action=actions.DECISION_RECORD,
            target_kind=actions.TARGET_PROJECT,
            target_id=project.id,
            graph_id=project.graph_id,
            project_id=project.id,
            actor_id=actor.id,
            details={
                "key": project.key,
                "branch": branch.number,
                "decision": decision.number,
                "verdict": decision.verdict,
                "choice": decision.choice,
                "supersedes": supersedes.number if supersedes else None,
                "into": into.number if into else None,
            },
        )
        return decision
