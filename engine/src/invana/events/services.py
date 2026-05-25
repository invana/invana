"""Service layer for emitting domain audit events (RFC-018).

The single entry point for any service-layer function that wants to record
an event. Inserts into the same SQLAlchemy session as the state change so
they commit (or roll back) atomically.

Sensitive fields are stripped from any ``details`` dict before storage —
callers can pass an unfiltered payload and the helper takes care of redaction.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.events.models import ActorType, Event
from invana.events.store import EventStore

# ── Sensitive-field redaction ────────────────────────────────────────────────
#
# Defence in depth — call sites shouldn't pass these in the first place, but
# strip them anyway so a fresh emit_event call site can't accidentally leak.
# Match is suffix-based so "api_key", "password_hash", "auth_encrypted",
# "old_api_key", etc. are all caught.

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


async def emit_event(
    session: AsyncSession,
    *,
    action: str,
    target_kind: str | None = None,
    target_id: str | None = None,
    graph_id: str | None = None,
    actor_id: str | None = None,
    actor_type: ActorType = ActorType.user,
    details: dict | None = None,
    trace_id: str | None = None,
) -> Event:
    """Append an audit event to the current SQLAlchemy session.

    The event row commits with the surrounding state change (the caller is
    responsible for ``session.commit()`` after the rest of its work). On
    rollback the event row goes with it — no orphans either way.

    ``actor_type`` defaults to ``user``; callers running background work
    should pass ``ActorType.system`` and leave ``actor_id=None``.

    Sensitive fields in ``details`` (keys matching ``*_hash``, ``*_encrypted``,
    ``password``, ``api_key``, ``secret``, ``token``) are stripped before
    storage. Callers don't need to pre-filter, but they should avoid
    constructing those values in the first place where possible.
    """

    safe_details = _redact(details or {})

    event = Event(
        graph_id=graph_id,
        actor_id=actor_id,
        actor_type=actor_type,
        action=action,
        target_kind=target_kind,
        target_id=target_id,
        details=safe_details,
        trace_id=trace_id,
    )
    return await EventStore().add(session, event)


# ── Changed-keys diff helper ─────────────────────────────────────────────────


def diff_changed_fields(
    before: dict[str, Any],
    after: dict[str, Any],
    *,
    fields: list[str],
) -> dict[str, dict[str, Any]]:
    """Build a `{field: {before, after}}` diff over ``fields`` only.

    Skips any field whose value hasn't changed. Caller passes the explicit
    list of fields so we never compare across the entire entity (avoids
    leaking newly-added attributes by accident).

    Use:

        emit_event(
            ...,
            action=ACTIONS.SKILL_UPDATE,
            details={"changed": diff_changed_fields(
                before, after, fields=["name", "description", "content", "when_to_use"],
            )},
        )
    """
    out: dict[str, dict[str, Any]] = {}
    for f in fields:
        b = before.get(f)
        a = after.get(f)
        if b != a:
            out[f] = {"before": b, "after": a}
    return out


# ── OTel trace_id resolver ───────────────────────────────────────────────────


def current_trace_id() -> str | None:
    """Pull the OTel trace_id (hex) off the active span if telemetry is up.

    Returns None when telemetry isn't initialised or there's no active span.
    Safe to call from any service — never raises.
    """
    try:
        from opentelemetry import trace

        span = trace.get_current_span()
        ctx = span.get_span_context()
        if not ctx or not ctx.is_valid:
            return None
        return f"{ctx.trace_id:032x}"
    except Exception:
        return None
