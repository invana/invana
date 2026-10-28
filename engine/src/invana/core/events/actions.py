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
# docs/for-developers/modules/identity-and-access/features/roles.md — details carry
# ``username`` and ``roles``; the creator's own add is ``via: graph.create``.
MEMBER_ADD = "member.add"
MEMBER_REMOVE = "member.remove"
MEMBER_ROLES = "member.roles"

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
LENS_DELETE = "lens.delete"
# Requests (docs/for-developers/modules/govern/features/requests.md) — filed
# where an ask fails, resolved by a modeller.
REQUEST_CREATE = "request.create"
REQUEST_RESOLVE = "request.resolve"
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
# A statement that is always true in its scope, offered and cited. A rule with
# a check is also read at acts; a failed warn or report is a ``rule.check``.
RULE_CREATE = "rule.create"
RULE_PUBLISH = "rule.publish"
RULE_ACTIVATE = "rule.activate"
RULE_DEACTIVATE = "rule.deactivate"
RULE_CHECK = "rule.check"
# The model reported following the skill on a step (docs/for-developers/modules/work/spec.md — a
# self-report, labelled as one; ``skill.invoke`` needs executable skills).
SKILL_APPLY = "skill.apply"

# ── Graph models (modeller; docs/for-developers/modules/connect-and-model/features/domain-models.md)
# ──────────────────────────────────────────
MODEL_CREATE = "model.create"
MODEL_UPDATE = "model.update"
MODEL_DELETE = "model.delete"
MODEL_ACTIVATE = "model.activate"
# Archive and restore (docs/for-developers/modules/connect-and-model/features/the-model-page.md MP7)
MODEL_ARCHIVED = "model.archived"
MODEL_RESTORED = "model.restored"
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
# A breaking publish asked for review, and each end that is not a publish — the
# status rides in details (docs/for-developers/modules/connect-and-model/features/publish-review.md)
MODEL_REVIEW = "model.review"

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
# A person stopped a run (the-run-page.md); the run ends `stopped`, its children `parent_ended`.
RUN_STOP = "run.stop"
# A child run's unspent escrow went back to its parent (delegation.md).
ESCROW_RETURN = "escrow.return"

# ── Evals (docs/for-developers/modules/skills/features/evals.md) ─────────────────
EVAL_SET_UPDATE = "eval_set.update"  # judge pin, rubric
EVAL_CASE_CREATE = "eval_case.create"  # written, proposed or promoted from a run
EVAL_CASE_UPDATE = "eval_case.update"  # accepted, relabelled or retired
EVAL_CASE_DELETE = "eval_case.delete"
EVAL_RUN = "eval.run"  # an eval run settled, with its gate verdict
EVAL_DEGRADED = "eval.degraded"  # a drift run fell behind the last live run
EVAL_BUDGET_UPDATE = "eval_budget.update"

# ── Projects (docs/for-developers/modules/work/spec.md) ────────────────────────────────────────────────────
PROJECT_CREATE = "project.create"
PROJECT_UPDATE = "project.update"
PROJECT_ARCHIVE = "project.archive"
PROJECT_UNARCHIVE = "project.unarchive"  # archiving is reversible, and the way back is its own fact
PROJECT_STAFF = "project.staff"
PROJECT_UNSTAFF = "project.unstaff"
PROJECT_DELETE = "project.delete"
# The records a quest is made of (docs/for-developers/modules/work/features/branches-and-decisions.md)
BRANCH_FORK = "branch.fork"
FINDING_ADD = "finding.add"
FINDING_REVIEW = "finding.review"
DECISION_RECORD = "decision.record"  # a verdict and a decision; a superseding one names its predecessor
PROPOSAL_SUBMIT = "proposal.submit"
PROPOSAL_ACCEPT = "proposal.accept"
PROPOSAL_REJECT = "proposal.reject"
REPORT_GENERATE = "report.generate"
REPORT_PUBLISH = "report.publish"
SIMULATION_RUN = "simulation.run"  # a simulator run opened on a branch (modules/work/features/simulation.md)

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
AGENT_SOUL_SET = "agent.soul_set"  # the soul or its voice dials (SO C4 · AG16)
AGENT_ACTIVATE = "agent.activate"  # a draft agent created through its eval gate
AGENT_PAUSE = "agent.pause"
AGENT_RESUME = "agent.resume"
AGENT_RETIRE = "agent.retire"
AGENT_DELETE = "agent.delete"
AGENT_SPAWN = "agent.spawn"  # an agent created an agent; actor_kind = agent
AGENT_SET_DEFAULT = "agent.set_default"  # the graph's default agent

# ── Flow library (docs/for-developers/modules/agents/spec.md) ────────────────────────────────────────
FLOW_PROMOTE = "flow.promote"  # a served plan became a library entry

# ── Datasets / ingestion (docs/for-developers/modules/bring-data-in/features/load-data.md)
# ────────────────────────────────────────────
DATASET_IMPORT = "dataset.import"

# ── Datasets, above Graphs (docs/for-developers/modules/bring-data-in/features/datasets.md)
# A dataset's events carry no graph_id; only a bind belongs to a Graph.
DATASET_CREATE = "dataset.create"
DATASET_VERSION = "dataset.version"  # mints a version
DATASET_UPDATE = "dataset.update"  # metadata — never a version
DATASET_RETRACT = "dataset.retract"
DATASET_BIND = "dataset.bind"
DATASET_STANDARD_ATTACH = "dataset.standard_attach"
DATASET_STANDARD_DETACH = "dataset.standard_detach"

# ── Standards, above Graphs (docs/for-developers/modules/bring-data-in/features/standards.md)
STANDARD_CREATE = "standard.create"
STANDARD_VERSION = "standard.version"  # mints a version

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
# (docs/for-developers/modules/identity-and-access/features/tokens.md).
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

# Annotations (4.8)
ANNOTATION_CREATE = "annotation.create"
ANNOTATION_UPDATE = "annotation.update"
ANNOTATION_DELETE = "annotation.delete"

# ── Schedules, notifications, approvals ───────────────────────────────────────
# docs/for-developers/modules/operate/features/schedules.md · notifications.md ·
# approvals.md. A rule never matches a delivery or a reminder, so nothing it
# sends can wake it again.
SCHEDULE_CREATE = "schedule.create"
SCHEDULE_UPDATE = "schedule.update"
SCHEDULE_PAUSE = "schedule.pause"
SCHEDULE_RESUME = "schedule.resume"
SCHEDULE_DELETE = "schedule.delete"
SCHEDULE_FIRE = "schedule.fire"
SCHEDULE_SKIP = "schedule.skip"
NOTIFICATION_RULE_CREATE = "notification_rule.create"
NOTIFICATION_RULE_UPDATE = "notification_rule.update"
NOTIFICATION_RULE_DELETE = "notification_rule.delete"
CHANNEL_CREATE = "channel.create"
CHANNEL_DELETE = "channel.delete"
DELIVERY_FAIL = "delivery.fail"
APPROVAL_REQUEST = "approval.request"
APPROVAL_APPROVE = "approval.approve"
APPROVAL_DECLINE = "approval.decline"
APPROVAL_EXPIRE = "approval.expire"
APPROVAL_REMIND = "approval.remind"
# Rules over the ledger (approvals.md, Alert rules) — each change is itself a ledger row.
ALERT_RULE_CREATE = "alert_rule.create"
ALERT_RULE_UPDATE = "alert_rule.update"
ALERT_RULE_DELETE = "alert_rule.delete"

# ── IAM (docs/for-developers/modules/identity-and-access/features/policies.md)
POLICY_CREATE = "policy.create"
POLICY_UPDATE = "policy.update"
POLICY_SAVE = "policy.save"
POLICY_DELETE = "policy.delete"
POLICY_ATTACH = "policy.attach"
POLICY_DETACH = "policy.detach"
GROUP_CREATE = "group.create"
GROUP_UPDATE = "group.update"
GROUP_DELETE = "group.delete"
GROUP_MEMBER_ADD = "group.member.add"
GROUP_MEMBER_REMOVE = "group.member.remove"
SERVICE_ACCOUNT_CREATE = "service_account.create"
DATASET_DRAFT = "dataset.draft"
DATASET_PUBLISH = "dataset.publish"
UNMATCHED_PREFIXES: tuple[str, ...] = ("delivery.", "notification.")
UNMATCHED_ACTIONS: frozenset[str] = frozenset({APPROVAL_REMIND})

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
# `kind` (GV1).
TARGET_LENS = "lens"
TARGET_REQUEST = "request"
TARGET_SKILL = "skill"
TARGET_RULE = "rule"
TARGET_MODEL = "graph_model"
TARGET_MODEL_LINK = "model_link"
TARGET_PROJECTION_TEMPLATE = "projection_template"
TARGET_DATASET = "dataset"
TARGET_STANDARD = "standard"
TARGET_USER = "user"
TARGET_QUERY = "query"
TARGET_SESSION = "session"
TARGET_BOARD = "board"
TARGET_ANNOTATION = "annotation"
TARGET_PROJECT = "project"
TARGET_TASK = "task"
TARGET_AGENT = "agent"
TARGET_THINKING = "run"
TARGET_EVAL_SET = "eval_set"
TARGET_FLOW = "flow"
TARGET_TOKEN = "personal_access_token"
TARGET_SCHEDULE = "schedule"
TARGET_NOTIFICATION_RULE = "notification_rule"
TARGET_CHANNEL = "channel"
TARGET_DELIVERY = "delivery"
TARGET_APPROVAL = "approval"
TARGET_ALERT_RULE = "alert_rule"
TARGET_POLICY = "policy"
TARGET_GROUP = "group"
TARGET_USER = "user"


# ── The change log (docs/for-developers/modules/operate/features/change-log.md)
# ──────────────────────────────────────────
# The actions that mint a version of a versioned record, by target kind. The
# change log is the events list narrowed to these — never a second record.
CHANGE_ACTIONS_BY_TARGET: dict[str, frozenset[str]] = {
    TARGET_SKILL: frozenset({SKILL_CREATE, SKILL_PUBLISH}),
    TARGET_RULE: frozenset({RULE_CREATE, RULE_PUBLISH}),
    TARGET_FLOW: frozenset({FLOW_PROMOTE}),
    TARGET_AGENT: frozenset({AGENT_CREATE, AGENT_UPDATE, AGENT_SOUL_SET}),
    # An import and an upgrade land as drafts; only publishing mints a version.
    TARGET_MODEL: frozenset({MODEL_ACTIVATE, MODEL_COMMIT}),
    TARGET_DATASET: frozenset({DATASET_VERSION, DATASET_PUBLISH}),
    TARGET_POLICY: frozenset({POLICY_SAVE}),
}
CHANGE_ACTIONS: frozenset[str] = frozenset().union(*CHANGE_ACTIONS_BY_TARGET.values())
