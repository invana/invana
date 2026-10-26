"""Tool steps: the wire forms a worker answers in, the enabled gate, the ``send`` approval.

Against the real app database, with the tool task types themselves stood in
for on ``TASKS`` — what is under test is where and whether a step runs, not
the network a tool reaches.
"""

from __future__ import annotations

import pytest

import invana.activity.models  # noqa: F401 — the approvals tables, for create_all
from invana.activity.managers import ApprovalManager
from invana.activity.models import Approval
from invana.apps.iam.managers.policies import PolicyManager
from invana.apps.iam.models import PolicyAttachment
from invana.plugins.envelope import outcome_from_json, outcome_to_json
from invana.runtime import catalogue as task_registry
from invana.runtime import workflows
from invana.runtime.catalogue import NeedsInput, Out, TaskFailure
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.models import TaskRun
from invana.runtime.querysets.plugins import PluginStateQuerySet
from invana.runtime.workflows import Step, Workflow
from tests.runtime.test_runtime import _fresh, _open, _run, _steps, _tabular

pytestmark = pytest.mark.asyncio


@pytest.fixture
def tool_steps(monkeypatch):
    """``web.read_url`` and ``mail.send`` stood in for, each in a one-step workflow."""
    calls: list[str] = []

    async def fetched(ctx, v):
        calls.append("web.read_url")
        v.result = _tabular()
        return Out(detail="fetched")

    async def sent(ctx, v):
        calls.append("mail.send")
        v.result = _tabular()
        return Out(detail="sent", output={"message_id": "<m@invana>"})

    monkeypatch.setitem(task_registry.TASKS, "web.read_url", fetched)
    monkeypatch.setitem(task_registry.TASKS, "mail.send", sent)
    monkeypatch.setitem(workflows.WORKFLOWS, "stub-fetch", Workflow("stub-fetch", (Step("web.read_url", "Fetch"),)))
    monkeypatch.setitem(workflows.WORKFLOWS, "stub-send", Workflow("stub-send", (Step("mail.send", "Send"),)))
    return calls


async def _enable(session, name: str, user) -> None:
    await PluginStateQuerySet().put(session, name=name, enabled=True, actor_id=user.id)
    await session.commit()


class TestWireForms:
    async def test_every_outcome_crosses_and_is_raised_again(self):
        out = outcome_from_json(outcome_to_json(Out(detail="3 rows", output={"rows": 3})))
        assert out.output == {"rows": 3}

        with pytest.raises(TaskFailure) as failed:
            outcome_from_json(outcome_to_json(TaskFailure(cls="blocked", cause="robots_disallowed", message="no")))
        assert (failed.value.cls, failed.value.cause) == ("blocked", "robots_disallowed")

        with pytest.raises(NeedsInput) as asked:
            outcome_from_json(
                outcome_to_json(NeedsInput(question="Which?", options=["A", "B"], descriptions=["", "More"]))
            )
        assert (asked.value.options, asked.value.descriptions) == (["A", "B"], ["", "More"])

    async def test_an_exception_the_worker_cannot_name_is_a_defect(self):
        with pytest.raises(TaskFailure) as failed:
            outcome_from_json(outcome_to_json(KeyError("boom")))
        assert (failed.value.cls, failed.value.cause) == ("defect", "worker_error")


class TestEnabledGate:
    async def test_a_disabled_tool_plugin_fails_and_enabling_it_lets_it_run(
        self, session, session_factory, graph, user, tool_steps
    ):
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, _, th = await _open(session, graph, user, "stub-fetch")
        await _run(runtime, th.id)

        [step] = await _steps(session, th.id)
        assert step.status == "failed" and step.error["cause"] == "plugin_disabled"
        assert "invana plugins enable invana.tools.web" in step.error["message"]
        assert tool_steps == []

        await _enable(session, "invana.tools.web", user)
        _, _, again = await _open(session, graph, user, "stub-fetch")
        await _run(runtime, again.id)

        assert (await _fresh(session, TaskRun, again.id)).status == "succeeded"
        assert tool_steps == ["web.read_url"]


class TestSendApproval:
    async def test_a_send_step_holds_on_an_approval_and_sends_once_approved(
        self, session, session_factory, graph, user, tool_steps, monkeypatch
    ):
        from invana.activity.managers import ApprovalSendGate

        monkeypatch.setattr(TaskRuntime, "send_gate", ApprovalSendGate())
        await _enable(session, "invana.tools.mail", user)
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, _, th = await _open(session, graph, user, "stub-send")
        # The default agent holds viewer; sending mail needs a policy that allows it.
        managed = {p.name: p for p in await PolicyManager().ensure_managed(session, graph_id=graph.id)}
        owner = managed["owner"]
        session.add(PolicyAttachment(policy_id=owner.id, graph_id=graph.id, holder_kind="agent", holder_id=th.agent_id))
        await session.commit()
        await _run(runtime, th.id)

        run = await _fresh(session, TaskRun, th.id)
        [step] = await _steps(session, th.id)
        assert (run.status, step.status, step.detail) == ("awaiting_input", "needs_input", "awaiting approval")
        approval = await session.get(Approval, run.cursor["approval"])
        assert (approval.subject_kind, approval.subject_id, approval.approver_ids) == ("step", step.id, [user.id])
        assert tool_steps == []

        await ApprovalManager().decide(session, graph=graph, approval_id=approval.id, user=user, approve=True)
        await session.commit()
        assert await runtime.resume_after_decision(th.id)
        await runtime._tasks[th.id]

        assert (await _fresh(session, TaskRun, th.id)).status == "succeeded"
        assert [s.id for s in await _steps(session, th.id)] == [step.id]
        assert tool_steps == ["mail.send"]
