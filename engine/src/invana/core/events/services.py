"""Service layer for emitting domain audit events (docs/for-developers/modules/operate/features/audit-and-activity.md).

The single entry point for any service-layer function that wants to record
an event. Inserts into the same SQLAlchemy session as the state change so
they commit (or roll back) atomically.

Sensitive fields are stripped from any ``details`` dict before storage —
callers can pass an unfiltered payload and the helper takes care of redaction.
"""

from __future__ import annotations

from typing import Any

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
