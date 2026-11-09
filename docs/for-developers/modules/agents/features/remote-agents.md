# Remote agents

An Invana agent hands a task to an agent **outside the Graph** — the Claude Code agent in a CI, a
partner's agent — over [A2A](https://a2a-protocol.org), and gets a verdict and artifacts back. MCP
carries tools ([13.13](../../platform/features/mcp-plugins.md)); A2A carries tasks: a lifecycle, a
question asked back, a pull request returned. Inside a Graph agents still [delegate](delegation.md).

> 🗓 **Implement later.** Designed, not scheduled: no slice owns it yet. It lands after the IAM
> policies and narrowed tokens, the world's send rules ([14.x](../../govern/spec.md)) and tool steps
> on workers ([13.11](../../platform/features/distributed-execution.md)), which it stands on. Product
> decisions and boards: AG-F05, linked below.

| | |
|---|---|
| Index | [5.11](../../../README.md#5--agents) · Slice **Later** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | 🔵 / 🔵 / 🔵 |
| Related | [delegation](delegation.md) · [envelope-and-budget](envelope-and-budget.md) · [mcp-plugins](../../platform/features/mcp-plugins.md) · [approvals](../../operate/features/approvals.md) |

Product spec: [AG-F05 · Delegation and outside agents](../../../../../specs/capabilities/agents/features/AG-F05-delegation-and-outside-agents/feature.md) — AG-33 and AG-34; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| `remote_agents` (install-wide) | `name` · `card_url` · `card` (frozen JSON) · `protocol_version` · `endpoint` · `auth_scheme` · `secret_name` · `pool_label` · `enabled` · `card_read_at` · limits (`wall_clock_s · attempts · at_once`) |
| The agent row | `kind = remote` · `remote_agent_id`; no envelope, budget or soul of its own |
| `remote_tasks` | `task_run_id` · `remote_agent_id` · `a2a_task_id` · `skill` · `state` · `sent` (the fields, as sent) · `held_back` · `artifacts` · `started_at · settled_at` — durations stored when the task settles |
| Steps | `delegate_remote` (bound `network`, side effect `send`) · `await_delegations` |
| Client | A2A over JSON-RPC/HTTPS from `invana worker`; the optional extra `invana[a2a]` |
| API | `GET·POST /api/v1/remote-agents` (the list contract) · `POST …/{name}/card` (read again) · `POST …/{name}/enable · disable` |
| CLI | `invana remote-agents add <card-url> --name <name> · refresh · enable · disable · list` |
| Events | `remote.delegated · remote.input_required · remote.returned · remote.refused` — each a ledger row |

## Decisions

Engine rows; the product decisions are AG-F05's.

| # | Decision |
|---|---|
| RA1 | **MCP carries tools, A2A carries tasks.** A tool call is one request and one answer; a fix has a lifecycle, asks back and returns artifacts. Version 0.3, the one the official SDKs carry; 1.0 when it ships. |
