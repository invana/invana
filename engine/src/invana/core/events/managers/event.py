"""Writing the record.

`core/events` holds the row and the write path; **nothing here knows what an app
is**. Each app subclasses ``EventManager`` and declares its own verbs and target
kinds — that is what keeps a feature shipping without touching `core`
(migration-plan §14.7, E1).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.events.models import ActorKind, Event
from invana.core.events.querysets import EventQuerySet

# Never stored, whatever a caller passes.
_REDACT_SUFFIXES: tuple[str, ...] = (
    "_hash",
    "_encrypted",
    "password",
    "api_key",
    "secret",
    "token",
)


def _is_sensitive(key: str) -> bool:
    k = key.lower()
    return any(k == s or k.endswith(s) for s in _REDACT_SUFFIXES)


def _redact(value: Any) -> Any:
    """Recursively drop sensitive keys from dicts; pass other shapes through."""
    if isinstance(value, dict):
        return {k: _redact(v) for k, v in value.items() if not _is_sensitive(k)}
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


# ── emit_event ───────────────────────────────────────────────────────────────


class AttributionError(ValueError):
    """An agent event was emitted without the human at the root of the chain."""


class EventManager:
    """The base. An app's subclass adds its vocabulary, never its own write path."""

    querysets = EventQuerySet()

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
        trace_id: str | None = None,
    ) -> Event:
        """Append an audit event to the current SQLAlchemy session.

        The event row commits with the surrounding state change (the caller is
        responsible for ``session.commit()`` after the rest of its work). On
        rollback the event row goes with it — no orphans either way.

        ``actor_kind`` defaults to ``user``; callers running background work should
        pass ``ActorKind.system`` and leave ``actor_id=None``. ``actor_type`` is the
        pre-docs/for-developers/modules/work/spec.md spelling, accepted so call sites migrate without a flag day.

        **An ``agent`` row must name the human it acted for.** ``on_behalf_of_user_id``
        is set by the engine from the root run, never from anything an agent
        can influence, and this helper refuses the row when it is missing — the
        attribution chain is only worth reading if it cannot be skipped
        (docs/for-developers/modules/work/spec.md, *attribution laundering*).

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

        safe_details = _redact(details or {})

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
        )
        return await self.querysets.add(session, event)
