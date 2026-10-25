"""Effective access at dispatch: a step no policy layer allows is refused before it runs.

docs/for-developers/modules/identity-and-access/features/effective-access.md —
an agent whose policies do not cover a step's function is refused naming them,
and the step's ledger row is ``refused`` by ``grant``; a person who started the
run bounds it with their own roles; a boundary bounds everyone. Real Postgres,
the managed policies written by the engine.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from invana.apps.agents.models import Agent
from invana.apps.graphs.models import GraphMember
from invana.apps.iam.managers import Held
from invana.apps.iam.managers.policies import PolicyManager
from invana.apps.iam.models import Policy, PolicyAttachment
from invana.core.ledger.models import LedgerRow
from invana.core.policy import parse_statements
from invana.runtime.access import AccessGate, Holder, decide
from invana.runtime.catalogue import RunVars, TaskFailure
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.services import _queue_steps
from invana.runtime.workflows import Step, Workflow
from tests.runtime.test_runtime import _fresh, _run, _steps

pytestmark = pytest.mark.asyncio

_CREATE = Workflow("access-create-task", (Step("work.create_task", "Create a task"),))


async def _setup(session, graph, user, *, roles: list[str], holds: list[str]) -> tuple[Agent, TaskRun]:
    """The Graph's managed policies, ``user`` a member with ``roles``, and an agent holding ``holds``."""
    managed = {p.name: p for p in await PolicyManager().ensure_managed(session, graph_id=graph.id)}
    member = (
        await session.execute(
            select(GraphMember).where(GraphMember.graph_id == graph.id, GraphMember.user_id == user.id)
        )
    ).scalar_one()
    member.roles = roles
    agent = Agent(graph_id=graph.id, name="Fare Scout", created_by_kind="user", created_by_id=user.id)
    session.add(agent)
    await session.flush()
    for name in holds:
        session.add(
            PolicyAttachment(policy_id=managed[name].id, graph_id=graph.id, holder_kind="agent", holder_id=agent.id)
        )
    run = TaskRun(
        graph_id=graph.id,
        flow_key=_CREATE.key,
        ask_kind="nl",
        body="file a task",
        agent_id=agent.id,
        author_id=user.id,
        on_behalf_of_user_id=user.id,
        triggered_by="task",
    )
    session.add(run)
    await session.flush()
    _queue_steps(session, run, None, _CREATE)
    await session.commit()
    return agent, run


async def _refused_rows(session, graph) -> list[LedgerRow]:
    stmt = select(LedgerRow).where(LedgerRow.graph_id == graph.id, LedgerRow.act == "work.create_task")
    return list((await session.execute(stmt.execution_options(populate_existing=True))).scalars().all())


async def test_a_step_its_policies_do_not_cover_is_refused_before_dispatch(session, session_factory, graph, user):
    _, run = await _setup(session, graph, user, roles=["owner"], holds=["viewer"])

    await _run(TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x"), run.id)

    (step,) = await _steps(session, run.id)
    assert step.status == RunStatus.failed.value
    assert step.error["cause"] == "policy_refused"
    assert step.error["message"] == "viewer does not allow work.create_task on project/*."
    assert (await _fresh(session, TaskRun, run.id)).status == RunStatus.failed.value
    (row,) = await _refused_rows(session, graph)
    assert (row.verdict, row.refused_by, row.rule) == ("refused", "grant", step.error["message"])


async def test_the_person_who_started_it_bounds_it(session, session_factory, graph, user):
    _, run = await _setup(session, graph, user, roles=["viewer"], holds=["viewer", "contributor"])

    await _run(TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x"), run.id)

    (step,) = await _steps(session, run.id)
    message = step.error["message"]
    assert message.startswith(user.username)
    assert message.endswith("holds viewer, which does not allow work.create_task on project/*.")
    (row,) = await _refused_rows(session, graph)
    assert row.refused_by == "grant"


async def test_with_the_policy_held_the_step_passes_the_check(session, graph, user):
    agent, run = await _setup(session, graph, user, roles=["owner"], holds=["viewer", "contributor"])
    vars_ = RunVars(
        graph=graph,
        sess=None,
        actor_id=user.id,
        encryption_key="x",
        user_message_id="",
        user_seq=0,
        assistant_message_id="",
        mode="nl",
        prompt="file a task",
        agent=agent,
        run=run,
    )

    await AccessGate().check(session, run=run, step_key="work.create_task", args={}, vars=vars_)

    with pytest.raises(TaskFailure) as refused:
        await AccessGate().check(session, run=run, step_key="graph.write.records", args={}, vars=vars_)
    assert refused.value.evidence["layer"] == "policies"


async def test_a_boundary_refuses_what_every_other_layer_allows():
    owner = Policy(id="p1", name="owner", kind="managed", statements=[{"actions": ["*"], "resources": ["*"]}])
    fence = Policy(
        id="p2", name="no-web", kind="boundary", statements=[{"actions": ["*"], "resources": ["graph/*", "llm/*"]}]
    )
    held = (Held(policy=owner, how="direct", statements=tuple(parse_statements(owner.statements))),)
    boundary = Held(policy=fence, how="boundary", statements=tuple(parse_statements(fence.statements)))
    agent = Holder(kind="agent", id="a1", name="Fare Scout", held=held)

    web = decide(
        action="web.read_url", resource="third_party/web/ba.com", bound="network", agent=agent, boundaries=[boundary]
    )
    graph = decide(action="graph.read.query", resource="graph", bound="graph_read", agent=agent, boundaries=[boundary])

    assert not web.allowed and web.refused.layer == "boundary"
    assert web.message == "boundary no-web does not allow web.read_url on third_party/web/ba.com."
    assert graph.allowed
