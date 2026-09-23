"""Action vocabulary for audit events (docs/for-developers/modules/operate/features/audit-and-activity.md § Action
vocabulary).

Hierarchical dotted-path strings keyed by feature area. Callers should
reference these constants rather than passing strings so the vocabulary stays
greppable and a renamed action surfaces as a compile-time miss.

New actions go here as services land. Keep the prefix consistent with the
feature area so `?action_prefix=skill.` continues to work in the read API.
"""

from __future__ import annotations

# ── Graph container (docs/for-developers/modules/identity-and-access/spec.md)
# ─────────────────────────────────────────────────
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
# Backend version compatibility (docs/for-developers/modules/graph-connectors/features/capabilities.md)
CONNECTION_VERSION_DETECTED = "connection.version_detected"
CONNECTION_COMPATIBILITY_DOWNGRADE = "connection.compatibility_downgrade"
CONNECTION_VERSION_ACKNOWLEDGE = "connection.version_acknowledge"
CONNECTION_VERSION_DECLARE = "connection.version_declare"

# ── Members ───────────────────────────────────────────────────────────────────
# Membership is binary post-docs/for-developers/modules/identity-and-access/features/membership.md; the owner is added
# once at graph creation.
# Role-change / removal / invitation actions were removed with the feature.
MEMBER_ADD = "member.add"

# ── LLM providers (docs/for-developers/modules/operate/features/audit-and-activity.md)
# ─────────────────────────────────────────────
LLM_CREATE = "llm.create"
LLM_UPDATE = "llm.update"
LLM_DELETE = "llm.delete"
LLM_PING = "llm.ping"
# `llm.set_default` is retired with `is_default` (PM4) — the cast is the answer.
LLM_MODEL_ADD = "llm_model.add"
LLM_MODEL_REMOVE = "llm_model.remove"
# NL → query mapping (docs/for-developers/modules/ask/features/ask-in-natural-language.md); target = session
LLM_TRANSLATE = "llm.translate"

# ── Govern — the lens (docs/for-developers/modules/govern/spec.md) ───────────
#
# A guardrail edit is an **ordinary audited write**, here with every other one:
# there is no separate governance log to keep in step with the real one (GR7).
# `before` and `after` ride on the payload, so *who loosened what, when, and what
# it was before* is a question this answers by itself.
LENS_CREATE = "lens.create"
LENS_UPDATE = "lens.update"
# The write that publishes — naming a lens is what puts it in the Worlds list,
# and it is worth telling apart from any other update (GV2).
LENS_NAME = "lens.name"
# A world became a guardrail. One field, never a re-authoring (GV3).
LENS_PROMOTE = "lens.promote"
LENS_DELETE = "lens.delete"
# The one field-level permission in the product, granted or taken back (GV22).
GUARDRAIL_PERMISSION_GRANT = "guardrail_permission.grant"
GUARDRAIL_PERMISSION_REVOKE = "guardrail_permission.revoke"

# ── Skills ────────────────────────────────────────────────────────────────────
SKILL_CREATE = "skill.create"
SKILL_UPDATE = "skill.update"
SKILL_DELETE = "skill.delete"
# A new immutable version was published (docs/for-developers/modules/skills/features/authoring-a-skill.md
# SK2). Editing the prose emits this, not ``skill.update`` — the old text still
# exists and is still being resolved by the steps it was offered to.
SKILL_PUBLISH = "skill.publish"
# Who was offered what, and when the bindings changed
# (docs/for-developers/modules/skills/features/bindings.md C5). The target is the
# agent, because the binding is a fact about the agent's context; ``details``
# names the skill.
AGENT_SKILL_BOUND = "agent.skill_bound"
AGENT_SKILL_UNBOUND = "agent.skill_unbound"

# ── Rules (docs/for-developers/modules/skills/features/rules.md) ──────────────
# A statement that is always true in its scope. Offered and cited, never
# enforced — there is no ``rule.enforce`` because a rule does not fire.
RULE_CREATE = "rule.create"
RULE_PUBLISH = "rule.publish"
RULE_ACTIVATE = "rule.activate"
RULE_DEACTIVATE = "rule.deactivate"
# The model reported following the skill on a step (docs/for-developers/modules/work/spec.md — a
# self-report, labelled as one; ``skill.invoke`` needs executable skills).
SKILL_APPLY = "skill.apply"

# ── Graph models (modeller; docs/for-developers/modules/connect-and-model/features/domain-models.md)
# ──────────────────────────────────────────
MODEL_CREATE = "model.create"
MODEL_UPDATE = "model.update"
MODEL_DELETE = "model.delete"
MODEL_ACTIVATE = "model.activate"
# NL → proposed model written to a draft (docs/for-developers/modules/ask/spec.md); target = session
MODEL_GENERATE = "model.generate"
# The staged set turned into a published version in one action
# (docs/for-developers/modules/connect-and-model/features/model-editor.md ME5)
MODEL_COMMIT = "model.commit"
MODEL_DISCARD = "model.discard"
# Portability (docs/for-developers/modules/connect-and-model/features/share-a-model.md)
MODEL_EXPORT = "model.export"
MODEL_IMPORT = "model.import"
MODEL_UPGRADE = "model.upgrade"

# ── Model links (docs/for-developers/modules/connect-and-model/features/stitch-models.md)
# ──────────────────────────────────────────
# ── Projection templates (docs/for-developers/modules/ask/features/projections.md)
PROJECTION_TEMPLATE_CREATE = "projection_template.create"
PROJECTION_TEMPLATE_PUBLISH = "projection_template.publish"
PROJECTION_TEMPLATE_DELETE = "projection_template.delete"

MODEL_LINK_DECLARE = "model_link.declare"
MODEL_LINK_REMOVE = "model_link.remove"
MODEL_LINK_COMMIT = "model_link.commit"
MODEL_LINK_DISCARD = "model_link.discard"

# ── TaskRuns (docs/for-developers/modules/ask/spec.md ·
# docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) — the run behind a session reply or a task ──
THINKING_OPEN = "run.open"  # a run started, under which agent, for whom
THINKING_FINISH = "run.finish"  # succeeded | failed, with duration
THINKING_CANCEL = "run.cancel"  # stopped by the user; cascades to children
THINKING_DELEGATE = "run.delegate"  # a step opened a child run (docs/for-developers/modules/work/spec.md)
THINKING_RESUME = "run.resume"  # a clarification was answered

# ── Projects (docs/for-developers/modules/work/spec.md) ────────────────────────────────────────────────────
PROJECT_CREATE = "project.create"
PROJECT_UPDATE = "project.update"
PROJECT_ARCHIVE = "project.archive"
PROJECT_UNARCHIVE = "project.unarchive"  # archiving is reversible, and the way back is its own fact
PROJECT_STAFF = "project.staff"
PROJECT_UNSTAFF = "project.unstaff"
PROJECT_DELETE = "project.delete"

# ── Tasks — the assignable unit of work (docs/for-developers/modules/work/spec.md) ─────────────────────────
TASK_CREATE = "task.create"
TASK_UPDATE = "task.update"
TASK_ASSIGN = "task.assign"
TASK_UNASSIGN = "task.unassign"
TASK_START = "task.start"
TASK_NEEDS_INPUT = "task.needs_input"
TASK_ANSWER = "task.answer"
TASK_BLOCK = "task.block"
TASK_DEPEND = "task.depend"
TASK_UNDEPEND = "task.undepend"
TASK_RESULT = "task.result"  # the assignee posted a result → review
TASK_ACCEPT = "task.accept"  # a human accepted it → done. Agents may not.
TASK_REJECT = "task.reject"  # the note becomes a new run_ask on the same task
TASK_CANCEL = "task.cancel"
TASK_DELETE = "task.delete"

# ── Agents as principals (docs/for-developers/modules/work/spec.md) ────────────────────────────────────────
AGENT_CREATE = "agent.create"
AGENT_UPDATE = "agent.update"
AGENT_PAUSE = "agent.pause"
AGENT_RESUME = "agent.resume"
AGENT_RETIRE = "agent.retire"
AGENT_DELETE = "agent.delete"
AGENT_SPAWN = "agent.spawn"  # an agent created an agent; actor_kind = agent
AGENT_SET_DEFAULT = "agent.set_default"  # the graph's default agent
# The third bound moved: which world this agent works in
# ([AG2](docs/for-developers/modules/agents/features/author-an-agent.md)). Its own
# action, because widening an agent back to *Everything* is the line of the
# audit an auditor comes looking for.
AGENT_LENS_SET = "agent.lens_set"

# ── Workflows library (docs/for-developers/modules/agents/spec.md) ────────────────────────────────────
WORKFLOW_PROMOTE = "workflow.promote"  # a served plan became a library entry

# ── Datasets / ingestion (docs/for-developers/modules/bring-data-in/features/load-data.md)
# ────────────────────────────────────────────
DATASET_IMPORT = "dataset.import"

# ── Setup ─────────────────────────────────────────────────────────────────────
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
# Personal access tokens
# (docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md).
# Use is not an event — `last_used_at` on the row carries it; a refusal is,
# because a refusal is a signal (PT8).
TOKEN_CREATE = "token.create"
TOKEN_REVOKE = "token.revoke"
TOKEN_REFUSED = "token.refused"

# ── Query executions ──────────────────────────────────────────────────────────
QUERY_EXECUTE = "query.execute"

# ── Explorer node expand / traversal (docs/for-developers/modules/explore/features/graph-canvas.md)
# ────────────────────────────────
GRAPH_EXPAND = "graph.expand"

# ── Query sessions (docs/for-developers/modules/ask/spec.md) ──────────────────────────────────────────────────
SESSION_CREATE = "session.create"
SESSION_UPDATE = "session.update"  # agent change, with the diff (docs/for-developers/modules/agents/spec.md)
SESSION_DELETE = "session.delete"

# ── Boards (docs/for-developers/building-engine/boards-migration.md)
# ───────────────────────────────────────────────
BOARD_CREATE = "board.create"
BOARD_UPDATE = "board.update"
BOARD_DELETE = "board.delete"

# ── System-emitted events (actor_type=system) ─────────────────────────────────
SYSTEM_CONNECTION_HEALTH_CHECK = "system.connection_health_check"
SYSTEM_CONNECTION_RECONNECT = "system.connection_reconnect"
SYSTEM_INTROSPECT_COMPLETE = "system.introspect_complete"


# ── Target kinds (free-form strings, but enumerated for consistency) ─────────
TARGET_GRAPH = "graph"
TARGET_CONNECTION = "connection"
TARGET_MEMBER = "member"
TARGET_LLM = "llm_provider"
TARGET_LLM_MODEL = "llm_model"
# One kind for both a world and a guardrail — they are one row separated by
# `kind`, and an auditor reading the history of a promoted world should not have
# to follow it across two target kinds (GV1).
TARGET_LENS = "lens"
TARGET_SKILL = "skill"
TARGET_RULE = "rule"
TARGET_MODEL = "graph_model"
TARGET_MODEL_LINK = "model_link"
TARGET_PROJECTION_TEMPLATE = "projection_template"
TARGET_DATASET = "dataset"
TARGET_USER = "user"
TARGET_QUERY = "query"
TARGET_SESSION = "session"
TARGET_BOARD = "board"
TARGET_PROJECT = "project"
TARGET_TASK = "task"
TARGET_AGENT = "agent"
TARGET_THINKING = "run"
TARGET_WORKFLOW = "workflow"
TARGET_TOKEN = "personal_access_token"
