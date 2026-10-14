"""Proposals — what an agent suggests a person do on a branch
(docs/for-developers/modules/work/features/branches-and-decisions.md).

Agents propose; people decide. A proposal is a fork (child titles) or a
decision (the decide payload), attributed to an agent of the Graph and to the
signed-in principal that sent it. Accepting performs the act **as the person
accepting** — a decision proposal runs the full decide, rules included, and a
refusal leaves the proposal open because the request writes nothing. Rejecting
is recorded with its note.

Usage::

    proposals = ProposalManager()
    p = await proposals.submit(session, graph_id=g.id, project=p, branch=b, payload=ProposalCreate(...), actor=u)
    await proposals.accept(session, project=p, proposal=p, actor=u)
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.work.managers.branch import BranchManager
from invana.apps.work.managers.decision import DecisionManager
from invana.apps.work.managers.project import ProjectManager
from invana.apps.work.models import Project, ProjectBranch, ProjectProposal, ProposalKind, ProposalStatus
from invana.apps.work.querysets import ProjectBranchQuerySet, ProjectProposalQuerySet
from invana.apps.work.schemas import DecisionCreate, ProposalCreate, ProposalRead
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event


class ProposalManager:
    """Stateless. The session is the first argument of every method."""

    proposals_qs = ProjectProposalQuerySet()
    branches_qs = ProjectBranchQuerySet()
    projects = ProjectManager()
    branches = BranchManager()
    decisions = DecisionManager()

    async def list(
        self, session: AsyncSession, *, project: Project, branch: ProjectBranch | None = None, status: str | None = None
    ) -> list[ProposalRead]:
        rows = await self.proposals_qs.list_for_project(
            session, project_id=project.id, branch_id=branch.id if branch else None, status=status
        )
        numbers = await self.branches_qs.numbers_by_ids(session, [r.branch_id for r in rows])
        out = []
        for row in rows:
            read = ProposalRead.model_validate(row)
            read.branch_number = numbers.get(row.branch_id)
            out.append(read)
        return out

    async def read(self, session: AsyncSession, proposal: ProjectProposal) -> ProposalRead:
        read = ProposalRead.model_validate(proposal)
        read.branch_number = (await self.branches_qs.numbers_by_ids(session, [proposal.branch_id])).get(
            proposal.branch_id
        )
        return read

    async def get(self, session: AsyncSession, *, project: Project, number: int) -> ProjectProposal:
        row = await self.proposals_qs.get_by_number(session, project_id=project.id, number=number)
        if row is None:
            raise NotFoundError(f"Proposal {number} not found in '{project.key}'.")
        return row

    async def submit(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        project: Project,
        branch: ProjectBranch,
        payload: ProposalCreate,
        actor: User,
    ) -> ProjectProposal:
        self.projects.require_writable(project)
        await AgentManager().get_or_404(session, agent_id=payload.agent_id, graph_id=graph_id)
        if payload.kind == ProposalKind.fork:
            titles = [t.strip() for t in payload.titles or [] if t.strip()]
            if not titles:
                raise ValidationError("A fork proposal names the branches to fork into.")
            body: dict = {"titles": titles}
        else:
            if payload.decision is None:
                raise ValidationError("A decision proposal carries the decision it proposes.")
            body = payload.decision.model_dump(exclude_none=True)
        proposal = ProjectProposal(
            project_id=project.id,
            branch_id=branch.id,
            number=await self.proposals_qs.next_number(session, project_id=project.id),
            kind=payload.kind,
            payload=body,
            rationale=payload.rationale,
            agent_id=payload.agent_id,
            submitted_by_id=actor.id,
        )
        await self.proposals_qs.add(session, proposal)
        await self._event(session, actions.PROPOSAL_SUBMIT, project, proposal, actor, branch=branch.number)
        return proposal

    def _require_open(self, proposal: ProjectProposal) -> None:
        if proposal.status != ProposalStatus.open:
            raise ConflictError(f"Proposal {proposal.number} is already {proposal.status}.")

    async def accept(
        self, session: AsyncSession, *, project: Project, proposal: ProjectProposal, note: str, actor: User
    ) -> ProjectProposal:
        """Do what was proposed, as the person accepting."""
        self._require_open(proposal)
        branch = await self.branches_qs.get(session, proposal.branch_id)
        if proposal.kind == ProposalKind.fork:
            children = await self.branches.fork(
                session, project=project, branch=branch, titles=proposal.payload.get("titles", []), actor=actor
            )
            result: dict = {"branches": [c.number for c in children]}
        else:
            decision = await self.decisions.decide(
                session,
                project=project,
                branch=branch,
                payload=DecisionCreate.model_validate(proposal.payload),
                actor=actor,
            )
            result = {"decision": decision.number}
        self._resolve(proposal, ProposalStatus.accepted, note, actor)
        proposal.result = result
        await session.flush()
        await self._event(session, actions.PROPOSAL_ACCEPT, project, proposal, actor, result=result)
        return proposal

    async def reject(
        self, session: AsyncSession, *, project: Project, proposal: ProjectProposal, note: str, actor: User
    ) -> ProjectProposal:
        self.projects.require_writable(project)
        self._require_open(proposal)
        self._resolve(proposal, ProposalStatus.rejected, note, actor)
        await session.flush()
        await self._event(session, actions.PROPOSAL_REJECT, project, proposal, actor, note=note)
        return proposal

    @staticmethod
    def _resolve(proposal: ProjectProposal, status: ProposalStatus, note: str, actor: User) -> None:
        proposal.status = status
        proposal.note = note
        proposal.resolved_by_id = actor.id
        proposal.resolved_at = datetime.now(UTC)

    @staticmethod
    async def _event(session, action, project: Project, proposal: ProjectProposal, actor: User, **details) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_PROJECT,
            target_id=project.id,
            graph_id=project.graph_id,
            project_id=project.id,
            actor_id=actor.id,
            details={
                "key": project.key,
                "proposal": proposal.number,
                "kind": proposal.kind,
                "agent_id": proposal.agent_id,
                **details,
            },
        )
