"""The runtime's ask gate — an agent asking a person, as a row in Approvals.

docs/for-developers/modules/operate/features/approvals.md: every ask an agent or
a run makes of a person is an ``approvals`` row with a ``kind``, routed to
whoever owns the thing asked for. The runtime sits below the inbox, so it names
only the gate's shape (``invana.runtime.interpreter.loop.AskGate``) and each
front-end installs this class on ``TaskRuntime.ask_gate``::

    TaskRuntime.ask_gate = ApprovalAskGate()

The runtime then raises an ask and holds the step that needs it::

    approval_id = await gate.ask(db, kind="delegation", graph_id=..., run_id=root.id,
                                 step_run_id=step.id, asked_by=chain, wants="delegate to Hub Checker",
                                 routed_reason="agent owner", approver_ids=[owner_id], payload={...})
    status, who, scope = await gate.verdict(db, approval_id=approval_id)

``verdict`` reads the row fresh — the run's session may have seen it before the
decision — and returns its status (``pending · approved · declined ·
expired``), the decider's username and the ``scope`` it was approved with.
The row is created through :class:`ApprovalManager`, so it notifies its
approvers and records ``approval.request`` exactly as every other ask does.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.approvals import ApprovalManager
from invana.activity.models import Approval
from invana.core.auth.models import User

#: How long an ask waits for its approver when the runtime names no deadline.
ASK_DEADLINE_S = 86400


class ApprovalAskGate:
    """Raise an ask of any ``kind`` as an approval, and read its decision back."""

    approvals = ApprovalManager()

    async def ask(
        self,
        db: AsyncSession,
        *,
        kind: str,
        graph_id: str,
        run_id: str | None,
        step_run_id: str | None,
        asked_by: list[dict],
        wants: str,
        routed_reason: str,
        approver_ids: list[str],
        payload: dict,
        title: str | None = None,
        deadline_s: int = ASK_DEADLINE_S,
    ) -> str:
        """Create the approval and return its id. Refused (422) with no approver to route to."""
        row = await self.approvals.request(
            db,
            graph_id=graph_id,
            subject_kind=kind,
            subject_id=step_run_id or run_id or graph_id,
            title=(title or wants)[:255],
            payload=payload,
            approver_ids=approver_ids,
            deadline_s=deadline_s,
            requested_by_id=next((a.get("id") for a in asked_by if a.get("kind") == "person"), None),
            run_id=run_id,
        )
        row.kind = kind
        row.asked_by = list(asked_by)
        row.wants = wants[:512]
        row.routed_reason = routed_reason[:64]
        row.step_run_id = step_run_id
        await db.flush()
        return row.id

    async def verdict(self, db: AsyncSession, *, approval_id: str) -> tuple[str, str, str | None]:
        """``(status, decided by, scope)``; a vanished approval reads as expired."""
        row = await db.get(Approval, approval_id, populate_existing=True)
        if row is None:
            return "expired", "", None
        who = await db.get(User, row.decided_by_id) if row.decided_by_id else None
        return row.status, who.username if who else "", row.scope
