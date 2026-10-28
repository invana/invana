"""Rules by scope — one list of every rule in force in a Graph, and what a check
would have broken over the last 30 days
(docs/for-developers/modules/skills/features/rules.md), against a real Postgres.

Worth testing: the read-back judges a decision by its evidence *as it stood*,
a check no act at its scope reads is refused, the list filters by scope and
act and carries the broken count, and a block names the rule's reason.
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from invana.apps.datasets.models import Dataset  # noqa: F401
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.schemas import RULE_LIST, RuleCheck, RuleCreate
from invana.apps.standards.models import Standard  # noqa: F401
from invana.apps.work.managers import BranchManager, DecisionManager, ProjectManager
from invana.apps.work.schemas import DecisionCreate, FindingCreate, ProjectCreate
from invana.core.errors import ConflictError, ValidationError
from invana.core.lists.params import parse_list_params
from invana.runtime.managers import RuleImpactManager, RulePageManager

projects = ProjectManager()
branches = BranchManager()
decisions = DecisionManager()
rules = RuleManager()
impact = RuleImpactManager()
pages = RulePageManager()

pytestmark = pytest.mark.asyncio

REVIEWED = {"kind": "evidence.reviewed"}


@pytest_asyncio.fixture
async def project(session, graph, user):
    payload = ProjectCreate(name="Flowering time", type="research", question="What sets flowering time?")
    return await projects.create(session, graph_id=graph.id, payload=payload, actor=user)


async def _decide_on_unreviewed(session, graph, user, agent, project):
    """A decision citing a finding nobody reviewed — no rule stopped it then."""
    root = await branches.get(session, project=project, number=1)
    finding = await branches.add_finding(
        session,
        graph_id=graph.id,
        project=project,
        branch=root,
        payload=FindingCreate(statement="Seen in the trial", stance="supports"),
        actor=user,
        agent_id=agent.id,
    )
    await decisions.decide(
        session,
        project=project,
        branch=root,
        payload=DecisionCreate(verdict="supported", choice="pursue", rationale="Trial", cites=[finding.number]),
        actor=user,
    )
    return finding


class TestImpact:
    async def test_a_decision_is_read_back_by_its_evidence_as_it_stood(self, session, graph, user, agent, project):
        finding = await _decide_on_unreviewed(session, graph, user, agent, project)
        # Reviewed after the decision: the decision still broke the check.
        await branches.review(session, project=project, finding=finding, actor=user)

        read = await impact.of_check(session, check=REVIEWED, scope="project", graph_id=graph.id, project_id=project.id)
        assert (read.days, read.read, read.broken) == (30, 1, 1)
        (item,) = read.items
        assert item.act == "project.decide" and item.subject == f"{project.key}/d1"
        assert f"f{finding.number} not reviewed" in item.reason

    async def test_a_check_no_act_at_its_scope_reads_is_refused(self, session, graph):
        with pytest.raises(ValidationError, match="No project act reads"):
            await impact.of_check(
                session, check={"kind": "dataset.licence", "allowed": ["CC-BY-4.0"]}, scope="project", graph_id=graph.id
            )


class TestRulesInForce:
    async def test_every_scope_in_one_list_filtered_by_scope_and_act(self, session, graph, user, agent, project):
        await _decide_on_unreviewed(session, graph, user, agent, project)
        await rules.create(
            session,
            graph_id=None,
            project_id=None,
            payload=RuleCreate(statement="Every dataset carries a licence"),
            actor_id=user.id,
        )
        await rules.create(
            session,
            graph_id=graph.id,
            project_id=None,
            payload=RuleCreate(statement="Airport codes are IATA"),
            actor_id=user.id,
        )
        await rules.create(
            session,
            graph_id=graph.id,
            project_id=project.id,
            payload=RuleCreate(statement="Decide on reviewed evidence only", check=RuleCheck(**REVIEWED), mode="block"),
            actor_id=user.id,
        )

        items, info = await pages.in_force(
            session, graph=graph, reader_id=user.id, params=parse_list_params(RULE_LIST, {})
        )
        assert [r.scope for r in items] == ["install", "graph", "project"] and info.total == 3
        working = items[2]
        assert working.project_name == "Flowering time" and working.acts == ["project.decide"]
        assert working.broken_30d == 1 and items[1].broken_30d is None

        items, info = await pages.in_force(
            session, graph=graph, reader_id=user.id, params=parse_list_params(RULE_LIST, {"act": ["project.decide"]})
        )
        assert [r.statement for r in items] == ["Decide on reviewed evidence only"]
        assert info.unfiltered_total == 3

    async def test_a_block_names_the_rules_reason(self, session, graph, user, agent, project):
        await rules.create(
            session,
            graph_id=graph.id,
            project_id=project.id,
            payload=RuleCreate(
                statement="Decide on reviewed evidence only",
                check=RuleCheck(**REVIEWED),
                mode="block",
                because="ISO 17025 audit",
            ),
            actor_id=user.id,
        )
        with pytest.raises(ConflictError, match=r"\(because ISO 17025 audit\)"):
            await _decide_on_unreviewed(session, graph, user, agent, project)
