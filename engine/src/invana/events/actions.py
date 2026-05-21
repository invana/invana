"""Action vocabulary for audit events (RFC-018 § Action vocabulary).

Hierarchical dotted-path strings keyed by feature area. Callers should
reference these constants rather than passing strings so the vocabulary stays
greppable and a renamed action surfaces as a compile-time miss.

New actions go here as services land. Keep the prefix consistent with the
feature area so `?action_prefix=skill.` continues to work in the read API.
"""

from __future__ import annotations

# ── Graph container (RFC-017) ─────────────────────────────────────────────────
GRAPH_CREATE = "graph.create"
GRAPH_UPDATE = "graph.update"
GRAPH_DELETE = "graph.delete"
GRAPH_ARCHIVE = "graph.archive"
GRAPH_UNARCHIVE = "graph.unarchive"

# ── GraphConnection ───────────────────────────────────────────────────────────
CONNECTION_ATTACH = "connection.attach"
CONNECTION_UPDATE = "connection.update"
CONNECTION_DELETE = "connection.delete"
CONNECTION_TEST = "connection.test"
CONNECTION_PING = "connection.ping"
CONNECTION_INTROSPECT = "connection.introspect"

# ── Members + Invitations ─────────────────────────────────────────────────────
MEMBER_ADD = "member.add"
MEMBER_ROLE_CHANGE = "member.role_change"
MEMBER_REMOVE = "member.remove"
INVITATION_CREATE = "invitation.create"
INVITATION_DELETE = "invitation.delete"
INVITATION_ACCEPT = "invitation.accept"

# ── LLM providers (RFC-018 § 2.6) ─────────────────────────────────────────────
LLM_CREATE = "llm.create"
LLM_UPDATE = "llm.update"
LLM_DELETE = "llm.delete"
LLM_PING = "llm.ping"
LLM_SET_DEFAULT = "llm.set_default"

# ── Skills + Instructions ─────────────────────────────────────────────────────
SKILL_CREATE = "skill.create"
SKILL_UPDATE = "skill.update"
SKILL_DELETE = "skill.delete"
INSTRUCTION_CREATE = "instruction.create"
INSTRUCTION_UPDATE = "instruction.update"
INSTRUCTION_DELETE = "instruction.delete"

# ── Setup wizard ──────────────────────────────────────────────────────────────
SETUP_COMPLETE = "setup.complete"
SETUP_SKIP = "setup.skip"
SETUP_RESET = "setup.reset"

# ── Auth + identity (no graph_id) ─────────────────────────────────────────────
AUTH_REGISTER = "auth.register"
AUTH_LOGIN = "auth.login"
AUTH_LOGIN_FAILED = "auth.login_failed"
AUTH_LOGOUT = "auth.logout"
AUTH_REFRESH = "auth.refresh"
AUTH_PASSWORD_CHANGE = "auth.password_change"
AUTH_USERNAME_CHANGE = "auth.username_change"

# ── Query executions ──────────────────────────────────────────────────────────
QUERY_EXECUTE = "query.execute"

# ── System-emitted events (actor_type=system) ─────────────────────────────────
SYSTEM_CONNECTION_HEALTH_CHECK = "system.connection_health_check"
SYSTEM_CONNECTION_RECONNECT = "system.connection_reconnect"
SYSTEM_INTROSPECT_COMPLETE = "system.introspect_complete"


# ── Target kinds (free-form strings, but enumerated for consistency) ─────────
TARGET_GRAPH = "graph"
TARGET_CONNECTION = "connection"
TARGET_MEMBER = "member"
TARGET_INVITATION = "invitation"
TARGET_LLM = "llm_provider"
TARGET_SKILL = "skill"
TARGET_INSTRUCTION = "instruction"
TARGET_USER = "user"
TARGET_QUERY = "query"
TARGET_SESSION = "session"
