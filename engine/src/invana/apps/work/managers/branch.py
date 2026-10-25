"""Branches and findings — the lines of inquiry in a project and the evidence on them
(docs/for-developers/modules/work/features/branches-and-decisions.md).

A branch's evidence is its ``branch_findings`` links, never a copy: a finding is
added on one branch (``via = own``), forking links the parent's findings into
each child (``fork``), and a merge decision links the chosen ones into its
target (``merge``). A branch's status is written by its decisions alone, so
nothing here moves it.

A finding a person adds is reviewed by them at once; an agent's waits for a
person to review it, which is what an ``evidence.reviewed`` rule reads.

Usage::

    branches = BranchManager()
    children = await branches.fork(session, project=p, branch=root, titles=["Early", "Late"], actor=u)
    finding = await branches.add_finding(session, graph_id=g.id, project=p, branch=children[0], payload=…, actor=u)
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.datasets.managers import DatasetManager
from invana.apps.work.managers.project import ProjectManager
from invana.apps.work.models import (
    CLOSED_BRANCH_STATUSES,
    FindingVia,
    Project,
    ProjectBranch,
    ProjectFinding,
)
from invana.apps.work.querysets import (
    BranchFindingQuerySet,
    ProjectBranchQuerySet,
    ProjectDecisionQuerySet,
    ProjectFindingQuerySet,
)
from invana.apps.work.schemas import BranchRead, Cite, FindingCreate, FindingRead
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event


class BranchManager:
    """Stateless. The session is the first argument of every method."""

    branches_qs = ProjectBranchQuerySet()
    links_qs = BranchFindingQuerySet()
    findings_qs = ProjectFindingQuerySet()
    decisions_qs = ProjectDecisionQuerySet()
    projects = ProjectManager()
    datasets = DatasetManager()

    # ── branches ─────────────────────────────────────────────────────────────

    async def get(self, session: AsyncSession, *, project: Project, number: int) -> ProjectBranch:
        branch = await self.branches_qs.get_by_number(session, project_id=project.id, number=number)
        if branch is None:
            raise NotFoundError(f"Branch {number} not found in '{project.key}'.")
        return branch

    async def list(self, session: AsyncSession, *, project: Project) -> list[BranchRead]:
        branches = await self.branches_qs.list_for_project(session, project_id=project.id)
        return await self.read(session, branches)

    async def read(self, session: AsyncSession, branches: list[ProjectBranch]) -> list[BranchRead]:
        """Branches with their parent and merge target as numbers, and their balance."""
        numbers = await self.branches_qs.numbers_by_ids(
            session, [b.parent_id or "" for b in branches] + [b.merged_into_id or "" for b in branches]
        )
        counts = await self.links_qs.stance_counts(session, branch_ids=[b.id for b in branches])
        out: list[BranchRead] = []
        for branch in branches:
            read = BranchRead.model_validate(branch)
            read.parent_number = numbers.get(branch.parent_id or "")
            read.merged_into_number = numbers.get(branch.merged_into_id or "")
            balance = counts.get(branch.id, {})
            read.supports = balance.get("supports", 0)
            read.contradicts = balance.get("contradicts", 0)
            read.context = balance.get("context", 0)
            current = await self.decisions_qs.current_for(session, branch_id=branch.id)
            read.current_decision = current.number if current else None
            out.append(read)
        return out

    async def children(self, session: AsyncSession, *, project: Project, branch: ProjectBranch) -> list[int]:
        rows = await self.branches_qs.list_for_project(session, project_id=project.id)
        return [b.number for b in rows if b.parent_id == branch.id]

    async def fork(
        self,
        session: AsyncSession,
        *,
        project: Project,
        branch: ProjectBranch,
        titles: list[str],
        actor: User,
    ) -> list[ProjectBranch]:
        """One child per title; each inherits the parent's findings. Open todos stay on the parent."""
        self.projects.require_writable(project)
        if branch.status in CLOSED_BRANCH_STATUSES:
            raise ConflictError(
                f"Branch {branch.number} is {branch.status} — revisit it with a decision that supersedes "
                "its last one before forking it."
            )
        cleaned = [t.strip()[:500] for t in titles if t.strip()]
        if not cleaned:
            raise ValidationError("A fork names at least one branch.")
        inherited = list(await self.links_qs.linked_ids(session, branch_id=branch.id))
        children: list[ProjectBranch] = []
        number = await self.branches_qs.next_number(session, project_id=project.id)
        for title in cleaned:
            child = ProjectBranch(
                project_id=project.id,
                number=number,
                parent_id=branch.id,
                title=title,
                created_by_kind="user",
                created_by_id=actor.id,
            )
            await self.branches_qs.add(session, child)
            await self.links_qs.link(session, branch_id=child.id, finding_ids=inherited, via=FindingVia.fork)
            children.append(child)
            number += 1
        await emit_event(
            session,
            action=actions.BRANCH_FORK,
            target_kind=actions.TARGET_PROJECT,
            target_id=project.id,
            graph_id=project.graph_id,
            project_id=project.id,
            actor_id=actor.id,
            details={"key": project.key, "branch": branch.number, "into": [c.number for c in children]},
        )
        return children

    # ── findings ─────────────────────────────────────────────────────────────

    async def findings(self, session: AsyncSession, *, branch: ProjectBranch) -> list[FindingRead]:
        rows = await self.links_qs.findings_of(session, branch_id=branch.id)
        numbers = await self.branches_qs.numbers_by_ids(session, [f.branch_id for f, _ in rows])
        out: list[FindingRead] = []
        for finding, via in rows:
            read = FindingRead.model_validate(finding)
            read.branch_number = numbers.get(finding.branch_id)
            read.via = via
            out.append(read)
        return out

    async def finding_read(self, session: AsyncSession, finding: ProjectFinding) -> FindingRead:
        read = FindingRead.model_validate(finding)
        read.branch_number = (await self.branches_qs.numbers_by_ids(session, [finding.branch_id])).get(
            finding.branch_id
        )
        return read

    async def get_finding(self, session: AsyncSession, *, project: Project, number: int) -> ProjectFinding:
        finding = await self.findings_qs.get_by_number(session, project_id=project.id, number=number)
        if finding is None:
            raise NotFoundError(f"Finding {number} not found in '{project.key}'.")
        return finding

    async def _cites(self, session: AsyncSession, cites: list[Cite], actor: User) -> list[dict]:
        """Shape-checked cites; a dataset cite resolves to its version id or is refused."""
        out: list[dict] = []
        for cite in cites:
            if cite.kind != "dataset":
                out.append({"kind": cite.kind, "ref": cite.ref})
                continue
            try:
                dataset, number = await self.datasets.get_by_ref(session, ref=cite.ref, reader=actor)
                if number is None:
                    raise ValidationError(f"Cite {cite.ref!r} names no version — cite publisher/name@v.")
                version = await self.datasets.get_version(session, dataset=dataset, version=number)
            except NotFoundError as exc:
                raise ValidationError(f"Cite {cite.ref!r} does not resolve: {exc}") from exc
            if version.state == "draft":
                raise ValidationError(f"Cite {cite.ref!r} is a draft version — cite a published one.")
            out.append({"kind": "dataset", "ref": f"{dataset.address}@{version.version}", "version_id": version.id})
        return out

    async def add_finding(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        project: Project,
        branch: ProjectBranch,
        payload: FindingCreate,
        actor: User,
        agent_id: str | None = None,
    ) -> ProjectFinding:
        """A person's finding is reviewed by them; an agent's waits for a person."""
        self.projects.require_writable(project)
        if agent_id is not None:
            await AgentManager().get_or_404(session, agent_id=agent_id, graph_id=graph_id)
        finding = ProjectFinding(
            project_id=project.id,
            branch_id=branch.id,
            number=await self.findings_qs.next_number(session, project_id=project.id),
            statement=payload.statement,
            stance=payload.stance,
            cites=await self._cites(session, payload.cites, actor),
            added_by_kind="agent" if agent_id else "user",
            added_by_id=agent_id or actor.id,
            reviewed_by_id=None if agent_id else actor.id,
            reviewed_at=None if agent_id else datetime.now(UTC),
        )
        await self.findings_qs.add(session, finding)
        await self.links_qs.link(session, branch_id=branch.id, finding_ids=[finding.id], via=FindingVia.own)
        await emit_event(
            session,
            action=actions.FINDING_ADD,
            target_kind=actions.TARGET_PROJECT,
            target_id=project.id,
            graph_id=project.graph_id,
            project_id=project.id,
            actor_id=actor.id,
            details={
                "key": project.key,
                "branch": branch.number,
                "finding": finding.number,
                "stance": finding.stance,
                "agent_id": agent_id,
            },
        )
        return finding

    async def review(self, session: AsyncSession, *, project: Project, finding: ProjectFinding, actor: User):
        """A person vouches for a finding. Once."""
        self.projects.require_writable(project)
        if finding.reviewed_by_id is not None:
            raise ConflictError(f"Finding {finding.number} is already reviewed.")
        finding.reviewed_by_id = actor.id
        finding.reviewed_at = datetime.now(UTC)
        await session.flush()
        await emit_event(
            session,
            action=actions.FINDING_REVIEW,
            target_kind=actions.TARGET_PROJECT,
            target_id=project.id,
            graph_id=project.graph_id,
            project_id=project.id,
            actor_id=actor.id,
            details={"key": project.key, "finding": finding.number},
        )
        return finding
