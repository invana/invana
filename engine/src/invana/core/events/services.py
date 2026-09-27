"""Service layer for emitting domain audit events.

The single entry point for any service-layer function that wants to record
an event. Inserts into the same SQLAlchemy session as the state change so
they commit (or roll back) atomically.

Sensitive fields are stripped from any ``details`` dict before storage by the
write path (``invana.core.redaction``) — callers can pass an unfiltered payload.
"""

from __future__ import annotations

from typing import Any

# ── emit_event ───────────────────────────────────────────────────────────────


class AttributionError(ValueError):
    """An agent event was emitted without the human at the root of the chain."""


async def emit_event(session, **kwargs):
    """Append an audit event. A thin forward to ``EventManager.emit``.

    Kept because 106 call sites say ``emit_event(...)``, and E1's per-app
    subclasses replace them one package at a time rather than in one commit
    (migration-plan §14.7).
    """
    from invana.core.events.managers import EventManager

    return await EventManager().emit(session, **kwargs)


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
