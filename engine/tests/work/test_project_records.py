"""Project records — branches, findings, decisions, proposals, the report and
private projects (docs/for-developers/modules/work/features/branches-and-decisions.md,
project-reports.md, private-projects.md), against a real Postgres.

What is worth testing is the governance: a verdict that skips a contradicting
finding is refused, a decision is never edited, a blocking rule writes nothing,
an agent proposes and a person decides, and a private project reads as absent.
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from invana.activity.managers.search import SearchManager
from invana.apps.datasets.models import Dataset  # noqa: F401
from invana.apps.graphs.models import GraphMember
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.schemas import RuleCheck, RuleCreate
from invana.apps.standards.models import Standard  # noqa: F401
from invana.apps.work.managers import (
    BranchManager,
    DecisionManager,
    ProjectManager,
    ProposalManager,
    ReportManager,
    StaffingManager,
    TaskManager,
)
from invana.apps.work.models import ProjectDecision
from invana.apps.work.schemas import (
    DecisionCreate,
    FindingCreate,
    ProjectCreate,
    ProjectUpdate,
    ProposalCreate,
    TaskCreate,
)
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events.models import Event
from invana.core.events.querysets import EventFilter, EventQuerySet

projects = ProjectManager()
branches = BranchManager()
decisions = DecisionManager()
proposals = ProposalManager()
reports = ReportManager()
staffing = StaffingManager()
tasks = TaskManager()

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def project(session, graph, user):
    payload = ProjectCreate(name="Flowering time", type="research", question="What sets flowering time?")
    return await projects.create(session, graph_id=graph.id, payload=payload, actor=user)


async def _finding(session, graph, project, branch, user, stance: str, **kwargs):
    payload = FindingCreate(statement=f"A {stance} finding", stance=stance, **kwargs)
    return await branches.add_finding(
        session, graph_id=graph.id, project=project, branch=branch, payload=payload, actor=user
    )


async def _count(session, model) -> int:
    from sqlalchemy import func, select

    return int((await session.execute(select(func.count()).select_from(model))).scalar_one())


class TestBranchesAndDecisions:
    async def test_fork_decide_supersede_merge_and_report(self, session, graph, user, project):
        root = await branches.get(session, project=project, number=1)
        assert root.title == "What sets flowering time?"
        await _finding(session, graph, project, root, user, "supports")
        early, late = await branches.fork(session, project=project, branch=root, titles=["Early", "Late"], actor=user)
        # Children inherit the parent's findings by reference.
        assert [f.via for f in await branches.findings(session, branch=early)] == ["fork"]
        against = await _finding(session, graph, project, early, user, "contradicts")

        # The verdict must answer every contradicting finding.
        with pytest.raises(ValidationError, match=f"f{against.number}"):
            await decisions.decide(
                session,
                project=project,
                branch=early,
                payload=DecisionCreate(verdict="supported", choice="pursue", rationale="Strong signal"),
                actor=user,
            )
        first = await decisions.decide(
            session,
            project=project,
            branch=early,
            payload=DecisionCreate(
                verdict="supported", choice="pursue", rationale="Strong signal", addresses=[against.number]
            ),
            actor=user,
        )
        assert early.status == "pursuing"

        # Never edited: a second decision must supersede, and cite newer evidence.
        again = DecisionCreate(
            verdict="refuted", choice="merge", rationale="Late wins", addresses=[against.number], into=late.number
        )
        with pytest.raises(ConflictError, match=f"d{first.number}"):
            await decisions.decide(session, project=project, branch=early, payload=again, actor=user)
        again.supersedes = first.number
        with pytest.raises(ValidationError, match="added after"):
            await decisions.decide(session, project=project, branch=early, payload=again, actor=user)
        await _finding(session, graph, project, early, user, "context")
        second = await decisions.decide(session, project=project, branch=early, payload=again, actor=user)

        assert early.status == "merged" and early.merged_into_id == late.id
        assert {f.via for f in await branches.findings(session, branch=late)} == {"fork", "merge"}
        (read,) = await decisions.read(session, [first])
        assert read.superseded_by_number == second.number and read.verdict_label == "supported"

        draft = await reports.generate(session, project=project, actor=user)
        assert "## Hypothesis 2: Early" in draft.draft
        version = await reports.publish(session, project=project, actor=user)
        assert (await reports.version(session, project=project, number=version.version)).body == draft.draft

    async def test_a_type_not_switched_on_is_refused(self, session, graph, user):
        with pytest.raises(ValidationError, match="not switched on"):
            await projects.create(
                session, graph_id=graph.id, payload=ProjectCreate(name="Futures", type="investment"), actor=user
            )


class TestRulesAndProposals:
    async def test_a_blocking_rule_refuses_and_writes_nothing(self, session, graph, user, agent, project):
        await RuleManager().create(
            session,
            graph_id=graph.id,
            project_id=project.id,
            payload=RuleCreate(
                statement="Decide on reviewed evidence only", check=RuleCheck(kind="evidence.reviewed"), mode="block"
            ),
            actor_id=user.id,
        )
        root = await branches.get(session, project=project, number=1)
        by_agent = await branches.add_finding(
            session,
            graph_id=graph.id,
            project=project,
            branch=root,
            payload=FindingCreate(statement="Seen in the trial", stance="supports"),
            actor=user,
            agent_id=agent.id,
        )
        proposal = await proposals.submit(
            session,
            graph_id=graph.id,
            project=project,
            branch=root,
            payload=ProposalCreate(
                agent_id=agent.id,
                kind="decision",
                rationale="The trial supports it",
                decision=DecisionCreate(verdict="supported", choice="pursue", rationale="Trial"),
            ),
            actor=user,
        )
        events_before = await _count(session, Event)
        with pytest.raises(ConflictError, match=f"f{by_agent.number} not reviewed"):
            await proposals.accept(session, project=project, proposal=proposal, note="", actor=user)
        assert await _count(session, ProjectDecision) == 0
        assert await _count(session, Event) == events_before
        assert proposal.status == "open"

        await branches.review(session, project=project, finding=by_agent, actor=user)
        await proposals.accept(session, project=project, proposal=proposal, note="ok", actor=user)
        assert proposal.status == "accepted" and proposal.result == {"decision": 1}
        (decision,) = await decisions.list_for_branch(session, project=project, branch=root)
        assert decision.checks[0].passed and decision.decided_by_id == user.id

        with pytest.raises(ConflictError, match="already accepted"):
            await proposals.reject(session, project=project, proposal=proposal, note="", actor=user)


class TestPrivateProjects:
    async def test_a_private_project_reads_as_absent_to_a_member_not_on_it(self, session, graph, user):
        other = User(email="other@example.com", username="other", password_hash="x", first_name="Other")
        session.add(other)
        await session.flush()
        session.add(GraphMember(graph_id=graph.id, user_id=other.id, roles=["contributor"]))
        await session.flush()

        secret = await projects.create(
            session,
            graph_id=graph.id,
            payload=ProjectCreate(name="Secret quest", type="policy", visibility="private"),
            actor=user,
        )
        todo = await tasks.create(
            session,
            graph=graph,
            payload=TaskCreate(title="Read the trial", project_key=secret.key, branch=1),
            actor=user,
        )

        assert [p.key for p in await projects.list_for_graph(session, graph_id=graph.id, reader_id=other.id)] == []
        with pytest.raises(NotFoundError):
            await projects.get_by_key(session, key=secret.key, graph_id=graph.id, reader_id=other.id)
        with pytest.raises(NotFoundError):
            await tasks.get(session, task_id=todo.id, graph_id=graph.id, reader_id=other.id)
        hits = (await SearchManager().search(session, reader=other, text="secret")).hits
        assert [h for h in hits if h.kind == "project"] == []
        everything = await EventQuerySet().list_page(session, filters=EventFilter(graph_id=graph.id), cursor=None)
        assert any(e.project_id == secret.id for e in everything.items)
        hidden = frozenset(await projects.hidden_ids(session, graph_id=graph.id, reader_id=other.id))
        feed = await EventQuerySet().list_page(
            session, filters=EventFilter(graph_id=graph.id, exclude_project_ids=hidden), cursor=None
        )
        assert [e for e in feed.items if e.project_id == secret.id] == []
        assert await projects.get_by_key(session, key=secret.key, graph_id=graph.id, reader_id=user.id)

        (mine,) = await staffing.list_for_project(session, project=secret)
        with pytest.raises(ConflictError, match="last person"):
            await staffing.unstaff(session, project=secret, assignment_id=mine[0].id, actor=user)

        # Opening it to the Graph makes it visible again; nothing else changes.
        await projects.update(session, project=secret, payload=ProjectUpdate(visibility="graph"), actor=user)
        assert [p.key for p in await projects.list_for_graph(session, graph_id=graph.id, reader_id=other.id)] == [
            secret.key
        ]


class TestCommandLine:
    async def test_a_cite_without_a_kind_is_a_usage_error(self):
        from click.testing import CliRunner

        from invana.cli.main import app

        args = ["findings", "add", "Seen", "--branch", "1", "--stance", "supports", "--cites", "ada/trials@3"]
        result = CliRunner().invoke(app, [*args, "--project", "flowering", "--graph", "ada/arabidopsis"])
        assert result.exit_code == 2
        assert "dataset:<publisher/name@v>" in result.output
