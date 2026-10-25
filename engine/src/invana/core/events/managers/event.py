"""Writing the record.

`core/events` holds the row and the write path; **nothing here knows what an app
is**. Each app subclasses ``EventManager`` and declares its own verbs and target
kinds — that is what keeps a feature shipping without touching `core`.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.core import ledger
from invana.core.auth.models import User
from invana.core.events import actions
from invana.core.events.models import ActorKind, Event
from invana.core.events.querysets import EventQuerySet
from invana.core.redaction import redact
from invana.core.telemetry.recorders import record_event
from invana.core.telemetry.spans import current_ids

#: Events that write no ledger row: high-volume reads and pings, and the acts the
#: runtime records as rows of its own (a spawn, a delegation, a run settling).
UNLEDGERED: frozenset[str] = frozenset(
    {
        actions.QUERY_EXECUTE,
        actions.GRAPH_EXPAND,
        actions.CONNECTION_PING,
        actions.CONNECTION_TEST,
        actions.LLM_PING,
        actions.LLM_TRANSLATE,
        actions.SKILL_APPLY,
        actions.APPROVAL_REMIND,
        actions.AGENT_SPAWN,
        actions.THINKING_DELEGATE,
        actions.THINKING_FINISH,
        actions.THINKING_CANCEL,
        actions.ESCROW_RETURN,
    }
)

#: An event's target kind → the ledger's layer; anything unlisted is ``run``.
LAYER_BY_TARGET: dict[str, str] = {
    actions.TARGET_THINKING: "run",
    actions.TARGET_SESSION: "run",
    actions.TARGET_AGENT: "agent",
    actions.TARGET_SKILL: "agent",
    actions.TARGET_RULE: "rule",
    "alert_rule": "rule",
    actions.TARGET_LENS: "lens",
    actions.TARGET_MEMBER: "access",
    actions.TARGET_USER: "access",
    actions.TARGET_TOKEN: "access",
    "guardrail_permission": "access",
    actions.TARGET_GRAPH: "graph",
    actions.TARGET_CONNECTION: "graph",
    actions.TARGET_MODEL: "graph",
    actions.TARGET_MODEL_LINK: "graph",
    actions.TARGET_DATASET: "graph",
    actions.TARGET_STANDARD: "graph",
    actions.TARGET_BOARD: "graph",
    actions.TARGET_ANNOTATION: "graph",
    actions.TARGET_PROJECTION_TEMPLATE: "graph",
    actions.TARGET_LLM: "llm",
    actions.TARGET_LLM_MODEL: "llm",
}

# ── emit_event ───────────────────────────────────────────────────────────────


class AttributionError(ValueError):
    """An agent event was emitted without the human at the root of the chain."""


class EventManager:
    """The base. An app's subclass adds its vocabulary, never its own write path."""

    events_qs = EventQuerySet()

    async def emit(
        self,
        session: AsyncSession,
        *,
        action: str,
        target_kind: str | None = None,
        target_id: str | None = None,
        graph_id: str | None = None,
        actor_id: str | None = None,
        actor_kind: ActorKind = ActorKind.user,
        actor_type: ActorKind | None = None,
        on_behalf_of_user_id: str | None = None,
        parent_event_id: str | None = None,
        project_id: str | None = None,
        task_id: str | None = None,
        run_id: str | None = None,
        node_run_id: str | None = None,
        skill_ids: list[str] | None = None,
        details: dict | None = None,
    ) -> Event:
        """Append an audit event to the current SQLAlchemy session.

        The event row commits with the surrounding state change (the caller is
        responsible for ``session.commit()`` after the rest of its work). On
        rollback the event row goes with it — no orphans either way.

        ``actor_kind`` defaults to ``user``; callers running background work should
        pass ``ActorKind.system`` and leave ``actor_id=None``. ``actor_type`` is the
        older spelling, accepted so call sites migrate without a flag day.

        **An ``agent`` row must name the human it acted for.** ``on_behalf_of_user_id``
        is set by the engine from the root run, never from anything an agent
        can influence, and this helper refuses the row when it is missing — the
        attribution chain is only worth reading if it cannot be skipped.

        **The row carries the trace and span it was written in.** Both ids are
        read off the current span, so a caller never passes them and a row from
        any code path opens the exact step that wrote it in the trace backend.
        Outside any span both are null.

        **Each row counts on ``invana.events.emitted``**, by action, once it is
        added to the session — the count is of rows written, and a row the
        caller later rolls back has still been counted.

        **A person's or an agent's act in a Graph is also a ledger row**, written
        in the same transaction through :func:`invana.core.ledger.record` (see
        :meth:`_ledger` for what is left out).

        Sensitive fields in ``details`` (keys matching ``*_hash``, ``*_encrypted``,
        ``password``, ``api_key``, ``secret``, ``token``) are stripped before
        storage. Callers don't need to pre-filter, but they should avoid
        constructing those values in the first place where possible.
        """

        kind = actor_type if actor_type is not None else actor_kind
        if kind == ActorKind.agent and not on_behalf_of_user_id:
            raise AttributionError(
                f"'{action}' was emitted by an agent with no on_behalf_of_user_id. "
                "Pass the human at the root of the chain."
            )

        safe_details = redact(details or {})
        trace_id, span_id = current_ids()

        event = Event(
            graph_id=graph_id,
            actor_id=actor_id,
            actor_kind=kind,
            on_behalf_of_user_id=on_behalf_of_user_id,
            parent_event_id=parent_event_id,
            project_id=project_id,
            task_id=task_id,
            run_id=run_id,
            node_run_id=node_run_id,
            skill_ids=list(skill_ids or []),
            action=action,
            target_kind=target_kind,
            target_id=target_id,
            details=safe_details,
            trace_id=trace_id,
            span_id=span_id,
        )
        added = await self.events_qs.add(session, event)
        record_event(action=action)
        await self._ledger(session, event, details or {})
        return added

    async def _ledger(self, session: AsyncSession, event: Event, details: dict) -> None:
        """Write the event's ledger row when a person or an agent caused it in a Graph.

        Same transaction as the event, so the two commit or roll back together.
        The engine's own work (``system``), a token or an anonymous caller, an
        event outside any Graph, and the high-volume reads in :data:`UNLEDGERED`
        write none — nor do the acts the runtime writes rows for itself. The
        chain is the person, then the acting agent, by the names the event
        carries (``details.actor_name``) or the person's username now.
        """
        if not event.graph_id or event.action in UNLEDGERED:
            return
        kind = event.actor_kind
        if kind not in (ActorKind.user, ActorKind.agent):
            return
        person_id = event.actor_id if kind == ActorKind.user else event.on_behalf_of_user_id
        chain: list[dict] = []
        if person_id:
            name = details.get("actor_name") if kind == ActorKind.user else None
            if not name:
                user = await session.get(User, person_id)
                name = user.username if user else ""
            chain.append({"kind": "person", "id": person_id, "name": name or ""})
        if kind == ActorKind.agent:
            chain.append({"kind": "agent", "id": event.actor_id, "name": details.get("actor_name") or ""})
        target = event.target_kind or ""
        named = details.get("name") or details.get("title") or details.get("username") or event.target_id or ""
        await ledger.record(
            session,
            graph_id=event.graph_id,
            actor_kind="agent" if kind == ActorKind.agent else "person",
            actor_chain=chain,
            actor_user_id=person_id,
            actor_agent_id=event.actor_id if kind == ActorKind.agent else None,
            act=event.action,
            layer=LAYER_BY_TARGET.get(target, "run"),
            touched=f"{target}/{named}" if target else str(named),
            verdict="allowed",
            run_id=event.run_id,
            step_run_id=event.node_run_id,
            run_number=details.get("run_number") if isinstance(details.get("run_number"), int) else None,
            where=str(details.get("where") or ""),
        )
