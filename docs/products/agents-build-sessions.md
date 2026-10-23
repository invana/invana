# Agents and IAM build — sessions

The build of the Agents design ([agent-fabric.md](agent-fabric.md)) and then IAM ([iam.md](iam.md)),
run as phases by `scripts/migration/run.py` with this file as its runbook. One phase is one row in the
log and **one commit**; a phase may span several sessions, handing off when a session's context
passes 400k tokens. Every phase is on **one branch**, `feat/agents-fabric`.

Run it:

```sh
INVANA_RUNBOOK=docs/products/agents-build-sessions.md \
INVANA_RUNNER_PROMPTS=scripts/agents-build/prompts \
INVANA_RUNNER_SCOPE=agents INVANA_RUNNER_GATES=full \
INVANA_MIGRATION_CONTEXT_LIMIT=400000 \
INVANA_MIGRATION_GRAPH_DB=bolt://localhost:27687 \
python3 scripts/migration/run.py
```

## Rules for every session

| Rule | Detail |
|---|---|
| The designs | The **Invana Products** canvas — <https://claude.ai/artifact/HcPfkMUYUtEbRaZFaYnHtg> (v46). Its source is `.design/canvas-products/` (`python3 products.py` rebuilds every board into `project/`); the local build is what is published. Board → story: the tables in `agent-fabric.md` and `iam.md` |
| Docs before code | Read the feature file before writing code; if the phase's features have no file, or a file disagrees with `agent-fabric.md` / `iam.md`, **write the feature file and its index row first** (CLAUDE.md rules 0–1). Decisions are present tense, no history |
| No backward compatibility | Rename records, keys, routes and tables outright; delete the old path in the same change; a migration may drop and recreate. Every capability and `demos/airways` keep working ([Delivery › Sequencing rules](../for-developers/README.md#sequencing-rules)) |
| Nothing Studio has is lost | Each row of [agent-fabric › Studio today, mapped](agent-fabric.md#studio-today-mapped) keeps its job; its **Deletes** column is deleted in the phase that moves it |
| Studio UI | Composed from `@invana/*` and tokens only; a missing component is built in `~/Projects/invana/design-kit` with a story (CLAUDE.md › Design rules). Detail heads use `RecordHeader variant="page"` |
| The backend owns every number | CLAUDE.md rule 13 — Studio formats, never derives |
| Validate against the boards | Before a phase is done, every board its stories name is shot live and from the prototype (`node scripts/migration/shoot.mjs --live|--proto --boards …`) and compared; **every board of every phase already done is shot live again**, so nothing regresses. Routes live in `scripts/migration/screen-map.json` — regenerate with `screen_map.py` when a route changes |
| Tests | Few positive and negative tests, against the graph database, never mocked (CLAUDE.md rules 5–7). Graph-database tests only against the isolated database the driver sets |
| Commits | The driver commits at the end of a phase. Never commit, push or open a PR from a session |
| Hand-off | Past 400k tokens of context, stop at a clean point, set the row `partial`, write a hand-off note with exactly where to resume |
| Ask Ravi | A phase that needs a decision not written in the docs sets its row `blocked` with the question |

## Phases

### F01 · Foundations

| | |
|---|---|
| Lands | [one list contract](../for-developers/modules/platform/spec.md#5-api-conventions) · 13.14 for the Fleet and Performance numbers · the applied-filters strip · `RecordHeader variant="page"` in Studio |
| Read | `docs/for-developers/modules/platform/spec.md` §5 · `agent-fabric.md` › Lists, filters and the assistant · `metrics-are-stored.md` |
| Steps | 1. Feature row and file for the list contract (Platform). 2. Engine: one `ListParams` / `Page[T]` (`q` · named filters · `sort` · `cursor` + `limit` → `{items, total, next_cursor, applied}`) and every Agents list on it — agents, skills, task plans, runs, LLM providers and models, plugins, catalogue, approvals, schedules, members. 3. Regenerate the Studio client. 4. Studio: filters in the URL (`?q=`, `?f.<field>=`), sent to the server; delete every client-side list filter. 5. design-kit: an applied-filters strip with a story. 6. Studio on the released kit with `RecordHeader variant="page"`. 7. The Fleet and Performance numbers as stored columns |
| Boards | `agents.runs.filtered` · `agents.agents.filtered` |
| Done when | Each Agents list is searched, filtered and paged through one helper; a filtered URL reloads to the same rows and chips |

### F02 · The breaking renames

| | |
|---|---|
| Lands | `TaskPlan` → **Flow** in record, table, API and Studio (*reusable workflow* folds into it) · dotted function names `namespace.verb` · one squashed migration baseline |
| Read | `terminology.md` · `orchestration.md` §0 · `agent-fabric.md` › The function library |
| Steps | 1. `terminology.md` first. 2. Squash the engine's migrations into one baseline; `invana migrate` from empty; reload `demos/airways`. 3. Rename the TaskPlan record, its routes and Studio's words. 4. Rename task types to their dotted names; recorded runs are rewritten or dropped |
| Boards | `agents.functions` · `agents.functions.detail` · `agents.plans` · `agents.plans.detail` |
| Done when | A clean checkout migrates from empty, loads airways, and no `task_plan` / `TaskPlan` / old task-type key is left in engine, API or Studio |

### F03 · The Agents shell

| | |
|---|---|
| Lands | The rail and workbook with no leftSection; Fleet, Performance, Agents, Skills, Functions, Connections › MCP servers, LLMs and Settings as pages |
| Read | `agent-fabric.md` › Shell and navigation · LLMs, Performance and Settings · Studio today, mapped · `docs/products/shell.md` |
| Steps | Port each surface onto the new shell, then delete what the mapped table names: `AgentsViewPanel`, `AgentsSection`, `SkillsViewPanel`, `LibraryViewPanel`, `PluginsViewPanel`, `AgentsSettingsViewPanel`, `PlanFlowCanvas`, the Agents leftSection wiring, unused API methods, Overview's broken *New agent* link. LLM endpoint details and adding one become modals |
| Boards | `agents.home` · `agents.open` · `agents.fleet.*` · `agents.performance*` · `agents.agents` · `agents.skills` · `agents.functions*` · `agents.plans` · `agents.plans.promote` · `agents.llms*` · `agents.settings` · `agents.connections.mcp*` |
| Done when | Every surface Studio had is reachable from the new rail, the Agents leftSection code is gone, e2e is green |

### F04 · Agents, skills and functions in detail

| | |
|---|---|
| Lands | The agent builder (Studio's first create-agent flow) · agent tabs Overview · Runs · Instructions · Soul · Model · Flow · Access · Limits · Deploy · Evals · History · lifecycle with open work named · the skill as a document with Flow · Functions · Agents · Usage · Exceptions · Evals · Tests · History · the Flow tab's engine · a function's page · Promote · Export YAML |
| Read | `agent-fabric.md` › Functions, skills and plans · Agents · the Agents feature files 5.2–5.9 · the Skills module |
| Boards | `agents.agent.*` · `agents.skill.*` · `agents.functions.detail` · `agents.functions.plugin` · `agents.functions.template*` |
| Done when | An agent is built on its page from a drafted skill, its Flow matches its instructions line by line, and publishing passes the eval gate |

### F05 · Runs, approvals, ledger and the assistant

| | |
|---|---|
| Lands | One runs list · the run page and its tabs, any size · Rerun (same · current · retune) · delegation with escrow, ceilings, exit reasons and may-delegate · Approvals (Waiting · Alert rules) · the Ledger · **the assistant opens a board with filters** |
| Read | `agent-fabric.md` › Runs · Approvals and the ledger · The assistant · `see-what-ran.md` · `approvals.md` · `delegation.md` |
| Boards | `agents.runs*` · `agents.run.*` (not `run.remote*`) · `agents.approvals*` · `agents.ledger*` |
| Done when | "Show me Route Auditor's failed runs this month" opens Runs with three chips the assistant set, and every act in that run has a ledger row |

### I01 · IAM and policies

| | |
|---|---|
| Lands | Policies (statements by layer, conditions, limits, draft, impact, Test access) · effective access = skill needs ∩ the agent's policies ∩ the run's starter ∩ world ∩ boundary, refused before dispatch naming the policy · People, service accounts, Groups · Agents (read-only) · narrowed, expiring tokens · an agent's Access tab attaches the same policies |
| Read | `iam.md` · the Identity and access module (11.1–11.6) · `agent-fabric.md` › Access |
| Boards | `iam.*` · `agents.agent.access` |
| Done when | A skill need no policy covers is refused naming the policy, and a narrowed token can push a draft dataset and nothing else |

### I02 · Connections in

| | |
|---|---|
| Lands | This Graph's MCP server — served agents and functions, callers with IAM tokens, Claude Code pushing **draft** datasets |
| Read | `agent-fabric.md` › This Graph's MCP server · `mcp-plugins.md` · `external-agent-api.md` |
| Boards | `agents.connections` |
| Done when | Claude Code, with a narrowed token, validates records and pushes a draft version that a person publishes |

### F06 · Workers

| | |
|---|---|
| Lands | Pools, labels, every worker and its step, Capacity, Add workers (Docker · Python · Kubernetes manifest), workers joining with an IAM service-account token |
| Read | `agent-fabric.md` › Workers · `distributed-execution.md` · `scale-out.md` |
| Steps | 1. Write `docs/for-developers/building-engine/workers-and-orchestration.md` — the options (procrastinate, Temporal, Hatchet, Restate, DBOS, Argo) against on-prem operability, recovery, fan-out and throughput, with a benchmark plan — then set the row `blocked` for Ravi's decision. 2. After the decision is in 13.11, build it |
| Boards | `agents.pools` · `agents.pool.*` · `agents.workers.*` |
| Done when | A worker on a second machine joins with a service-account token and runs a tool step |

Later, not scheduled: remote agents over A2A ([5.11](../for-developers/modules/agents/features/remote-agents.md)) — `agents.connections.agent*` · `agents.run.remote*`.

## Log

| ID | Phase | Kind | Needs | Branch | Status | Date | Notes |
|---|---|---|---|---|---|---|---|
| F01 | Foundations | engine+studio |  | `feat/agents-fabric` | pending |  |  |
| F02 | Breaking renames | engine+studio | F01 | `feat/agents-fabric` | pending |  |  |
| F03 | Agents shell | studio | F02 | `feat/agents-fabric` | pending |  |  |
| F04 | Detail pages | engine+studio | F03 | `feat/agents-fabric` | pending |  |  |
| F05 | Runs · approvals · ledger · assistant | engine+studio | F04 | `feat/agents-fabric` | pending |  |  |
| I01 | IAM and policies | engine+studio | F05 | `feat/agents-fabric` | pending |  |  |
| I02 | Connections in | engine+studio | I01 | `feat/agents-fabric` | pending |  |  |
| F06 | Workers | engine+studio | I02 | `feat/agents-fabric` | pending |  |  |

## Hand-off notes

| ID | Note |
|---|---|
