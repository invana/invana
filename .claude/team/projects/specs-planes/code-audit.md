# Code audit — what the code builds against `specs/` and *Decisions*

Read-only audit of `engine/`, `studio/` and `integrations/` for the `specs-planes` project, 2026-11-13. Where the code,
a spec and a decision disagree, the decision in [`project.md`](project.md) wins; the code becomes a `specs/migrations.md`
row, never a reopened question.

Legend — **Class**: `keep` (spec it or confirm the spec) · `finish` (half-built: spec the rest) · `merge` (two do one
job) · `drop` (code to delete; a `migrations.md` row) · `new spec` (built, no spec) · `spec only` (specced, no code).
**State**: built · half · stub · none.

## 1. The size of the breaking change

| Area | Today | Decision | Migration |
|---|---|---|---|
| Graph unit | `graphs` + `graph_connections` (UNIQUE `graph_id`, one DB per Graph); ~46 of 95 tables carry `graph_id`; ~37 routers under `/api/v1/u/{username}/{graphSlug}/…`; Studio's whole tree under `/u/:u/:g/…`, Graphs list, picker, connect page | D1 · D2 | The largest single row: drop the Graph unit, routes `/api/v1/<package>/<records>` |
| Graph roles | 6 roles stored per Graph on `graph_members.roles`, mirrored as managed policies (`apps/iam/managed.py`) | D14 | Operator · Modeller · Admin, one fixed table |
| Access model | IAM policies held by people, groups, agents, keys; agent ∩ person ∩ token ∩ boundary at each step | D11 · D12 · D13 | Agents-only, Allow/Ask/Deny × Read/Write/Run × `type/name`, team-scoped rules |
| Queries | The LLM writes raw Cypher/Gremlin (`apps/llm/translate.py` `submit_query`); a text check refuses writes | D10 | Typed query plan, validated, compiled |
| Read-only | App flag + query-text check (`apps/graphs/query_service.py:84`); no driver read mode, no `ReadOnlyStrategy` | D9 | Driver-level read mode |
| One graph DB per Graph | Pool keeps one connector per Graph; no stitching across databases | D7 · D8 | Many graph databases, one Graph, identity links |
| System graph | None; ArcadeDB is only a connector target | D5 · D6 | Bundled ArcadeDB + outbox |
| Storage | Postgres + local disk (`settings.dataset_dir`); no S3 | D26 | Blob interface over S3 (boto3), RustFS default |
| Encryption | One Fernet key (`INVANA_ENCRYPTION_KEY`) for connection, model-provider and channel secrets; dev fallback key; no rotation | D27 | Envelope AES-256-GCM, install key, Vault Transit |
| Customer data in Postgres | `dataset_records` stores records as rows; annotations in Postgres | D7 · D28 | Question Q-D1 below |

## 2. Feature by feature

| Feature | Code (main paths) | State | Class | Note |
|---|---|---|---|---|
| AC-F01 Sign in, account, sessions | `core/auth/**`, `server/routes/auth.py`, Studio `LoginPage`, `ProfileSettingsPage` | built | keep · finish | Missing: sign out everywhere, `signed_in_at` + 15-min fresh sign-in, refresh-reuse detection, `time_zone`. Split — §4 |
| AC-F02 Access rules | `core/policy.py`, `apps/iam/managers/{policies,managed,drafting}.py`, Studio `iam/policies` | built | keep (rewrite) | Becomes *Access Policies* (D12) + role table (D14) |
| AC-F03 Groups, keys, holders | `apps/iam/managers/{groups,people,holdings,tokens,service_accounts}.py` | built | keep · merge | Groups → teams (D13); keys split out (§4); service accounts — Q-A5 |
| AC-F04 What an agent may touch | `runtime/access.py`, `runtime/managers/access.py`, `apps/agents/envelope.py`, `apps/govern/managers/touch.py` | built | keep (rewrite) | Narrowing per hop (D30); declared needs (D29) are new |
| AC-F05 Asks and approvals | `activity/managers/{approvals,ask_gate}.py`, `apps/govern/managers/request.py`, `activity/managers/publish_reviews.py`, `TaskPrompt` | built ×3 | merge | One ask record; reminders + expiry exist (half-time remind, expire); escalation and named approvers (D16) missing |
| AC-F06 History | `core/events`, `core/ledger` (hash-chained), `activity/managers/changes.py`, `server/history`, `server/ledger` | built ×3 | merge | One install-wide chain; the ledger is the base |
| GR-F01 Open a graph | `apps/graphs`, Studio `GraphsListPage`, `GraphSwitcher` | built | drop | D1 |
| GR-F02 Create a graph | `apps/graphs/managers/connect.py`, `apps/setup/**`, Studio `GraphConnectPage` | built | merge | Connect → CP *Graph databases*; the setup checklist → J01 |
| GR-F03 Find your way | Studio `CommandPalette` (per-product search), `/api/v1/search` (unused by Studio), no 403 page | built · half | merge | ⌘K + search → CP; frame → design-language; a no-access page is missing |
| GR-F04 This graph | `apps/graphs/managers/member.py`, `server/members`, Studio Modeller › Graph settings | built | merge | Connection → *Graph databases*; members → Directory; Studio has members in two places |
| GR-F05 Inbox | `activity/managers/{notifications,channels,delivery}.py`, Studio `activity/inbox` | built | keep → CP | Channels email · Slack · webhook; Teams missing; channels are not plugins (D32) |
| RT-F01 AI models | `apps/llm_providers/**`, `apps/llm/**`, `apps/govern/managers/endpoint.py` | built | keep (rewrite) | Per Graph today → install-wide; local/external mark (D25) new |
| RT-F02 Plugins and outside tools | `plugins/registry.py`, `runtime/managers/{plugins,mcp,mcp_server}.py`, Studio `settings/plugins`, `agents/connections` | built | finish | Install switch only (no user switch, D18); core plugins grouped differently from D32 (§3); inbound server per Graph; outbound credentials in env |
| RT-F03 Workers and the queue | `plugins/{gateway,queue,remote,worker}.py`, `apps/workers/**`, Studio Fleet | built | keep | Bug: remote workers never load MCP plugins (§6) |
| RT-F04 Limits | `runtime/contention.py`, envelope budgets, IAM policy limits, `EvalBudget`, Studio Agents › Settings | built ×4 | merge | Per Graph today → per team, user, agent (one place) |
| RT-F05 Connectors | `graph/connectors/{base,cypher,gremlin}`, `integrations/*` | half | finish | neo4j, memgraph, janusgraph built; arcadedb, tinkergraph empty packages; neptune none; no connector registry; Gremlin lens a stub |
| RT-F06 Skill scripts | — | none | spec only | |
| AG-F01 Build an agent | `apps/agents/**`, `server/agents` (27 routes), Studio `AgentBuilder` | built | keep | Practice graph database new |
| AG-F02 Catalogue | `apps/agents/registry.py` (seeded agents, default agent), Studio Agents home/fleet | built | keep (rewrite) | Granted, not invited; built-ins per D31 |
| AG-F03 Runs | `server/runtime/runs.py`, `runtime/managers/{run_pages,run_stats}.py`; stats also in `agent_overview`, `activity/managers/fleet.py`, `plan_performance` | built | keep → CP · merge | Four stat computations over `task_runs` |
| AG-F04 Skills | `apps/skills/**`, `runtime/managers/skill_*.py` | built | keep | Declared needs new |
| AG-F05 Delegation, outside agents | `runtime/delegation.py`, `plugins/core/work_write`, outbound MCP | half | finish | No A2A |
| AG-F06 Plans and functions | `apps/flows` (read-only + promote), `runtime/workflows.py` (3 hard-coded), `runtime/planning.py`, `apps/llm/planner.py`, `runtime/catalogue` | half | merge · finish | Five notions of plan/flow/workflow (§5) |
| AG-F07 Schedules | `activity/managers/schedules.py`, `core/cron.py`, `activity/clock.py` | built | keep (rewrite) | Creator ∩ agent, pause on leave |
| AG-F08 Portable | `apps/flows/yaml_export.py`, `apps/modeller/{json_io,portability}.py` | half | finish | Export of flows and models only; no agent/skill import or export |
| EX-F01 Board and canvas | `apps/boards`, `runtime/canvas.py`, `apps/explorer` | built | keep | |
| EX-F02 Share and present | Studio `ShareAnswerDialog`; no engine share links or present mode | half | finish | |
| EX-F03 Ask a question | `apps/sessions`, `runtime/services.py` `open_turn`, `runtime/workflows.py` `nl-query` | built | keep (rewrite) | Raw query text → typed plan (D10); across graph databases (D7) |
| EX-F04 The answer | `runtime/emissions.py`, `runtime/projections.py` | built | keep | Projection templates have no spec (§3) |
| EX-F05 How it reasons | `apps/llm/clarify.py`, `runtime/diagnosis.py` | built | keep | + what-if from PJ-F04 |
| EX-F06 Annotate and edit | `apps/modeller/managers/data_edit.py`, `server/data_edits`, `apps/annotations` | built | keep · merge | Annotations → RC-F07; edits need a read + write connection (D9, D28) |
| EX-F07 Memory | a thumbs vote on a session message | stub | merge → AG | Thinking graph (D22) |
| PJ-F01 Projects and tasks | `apps/work/**` (experimental in Studio) | built | keep (light) | |
| PJ-F02 Objectives | one field in `NewProjectDialog` | none | spec only | Candidate to drop — PJ stays light |
| PJ-F03 Branches, findings, decisions | `apps/work/managers/{branch,decision,proposal}.py` | built | keep (rewrite) | Cite the thinking graph; impact from PJ-F04 |
| PJ-F04 Simulation and impact | `runtime/managers/simulation.py`, `plugins/simulators/genomic`, Studio `SimulationView` | built | drop | D23: what-if → EX-F05; genomic → Life sciences pack |
| PJ-F05 Reports | `apps/work/managers/report.py` | built | keep | |
| PJ-F06 Alerts | `activity/managers/alerts.py` are ledger alert rules per Graph, not data-pattern alerts | none (as specced) | spec only · merge | The built alert rules are CP *Ops alerting*; the spec's pattern-in-records alert is unbuilt |
| RC-F01 Records by kind | `apps/datasets/**` (records as Postgres rows), Studio Datasets catalogue | built | keep (rewrite) | Records read from graph databases, not copied — Q-D1 |
| RC-F02 Bring records in | `apps/datasets`, `runtime/managers/dataset_bind.py` (local disk), `graph/loaders/csv.py` (CLI only), MCP `push_draft_version` | built | keep (rewrite) | Into a read + write graph database; files via the blob store |
| RC-F03 Quality | `apps/modeller/validator.py`, `apps/datasets/managers/conformance.py` | built | keep | |
| RC-F04 Bulk fixes | — | none | spec only | |
| RC-F05 Merge duplicates | — | none | spec only | |
| RC-F06 Provenance | dataset record history only | half | finish | Lineage in the system graph (D5) |
| RC-F07 Annotations | `apps/annotations` (Postgres) | built | keep (rewrite) | Stored in the customer's graph database (D28) |
| SE-F01 Start a model | `apps/modeller/{introspector,starters}`, `apps/semantic` ontology import | built | keep | |
| SE-F02 Change and publish | `apps/modeller/{staging,versioner,projector}.py`, `managers/publishing.py` | built | keep | |
| SE-F03 Meaning | `description` columns only | stub | finish | + sensitive properties (D25) |
| SE-F04 Taxonomies | SKOS import flattened into a standard; `parent_type` single inheritance | stub | finish | |
| SE-F05 Standards | `apps/standards/**` (install-wide) | built | keep | |
| SE-F06 Links and mappings | `apps/modeller/{links,solve}.py`, `/model-links`, `/global-model` | built | keep (rewrite) | Identity match rules (D8) new; two graph↔model links coexist |
| SE-F07 Rules | `apps/skills` `Rule`, `runtime/managers/rule_*.py`, `apps/modeller` `validation_rules` | built | keep | "Rule" means four things (§5) |
| SE-F08 Inference | — | none | spec only | |
| SE-F09 Views | `apps/govern` lenses/worlds, `graph/connectors/*/lens.py`, Studio Modeller › Worlds | built | drop | → Access Policies + sensitive properties |
| SE-F10 Health and history | `apps/modeller/managers/{insights,query_log,physical_schema}.py` | built | keep | |

## 3. Built with no spec

| Capability | Code | Class | Where it belongs |
|---|---|---|---|
| Evals — sets, cases, drift, budget, LLM judge | `runtime/managers/evals.py`, `runtime/eval_checks.py`, `server/evals`, Studio skill Tests/Evals tabs | new spec | AG — *Test an agent and a skill* (with the practice graph database) |
| Projection templates | `runtime/projections.py`, `server/runtime/templates.py` | new spec | EX-F04 |
| Function catalogue | `runtime/catalogue`, `server/runtime/catalogue.py` | new spec | AG-F06 (the ladder's rung one) |
| Guardrails (property rules with impact) | `apps/govern/guardrail.py`, Studio Modeller › Guardrails | merge | Access Policies `data/<db>/<kind>` + sensitive properties |
| Run touches | `apps/govern/managers/touch.py` | merge | *Access usage* (the ledger, D24) |
| Query log | `core/querylog.py`, `apps/modeller/managers/query_log.py` | merge | The ledger (D24) |
| Setup checklist | `apps/setup/**` | new spec | J01 + CP *Overview* |
| Admin console (starlette-admin, `/admin`, cookie session) | `server/admin/**`, `*/admin.py` | drop | Q-A8 |
| `?token=` JWT on every route | `core/auth/deps.py:86-89` | drop | Event streams only |
| Core plugins | `pure`, `ingest`, `datasets`, `llm`, `schema_write`, `work_write`, `graph_read`, `graph_write` | merge | Regroup into D32's 12; task keys already match; `graph.stitch`, `thinking`, `ledger` are missing |
| `science` tool, `genomic` simulator | `plugins/tools/science`, `plugins/simulators/genomic` | drop | Life sciences pack (D32) |

## 4. Auth

### Built today

| Mechanism | Code | State | Spec |
|---|---|---|---|
| Passwords | bcrypt 12 rounds, minimum length 12, timing-safe unknown accounts (`core/auth/passwords.py`) | built | AC-F01 |
| Access token | HS256 JWT, 15 min, `sub` · `sup` · `type` · `iat` · `exp`; no `iss`/`aud`/`jti` (`core/auth/jwt.py`) | built | AC-F01 |
| Refresh token | Opaque, sha256, rotated, 7 days (`core/auth/tokens.py`) | half | No reuse detection, no `signed_in_at`, no absolute session cap |
| Studio session | Both tokens in `localStorage` `invana.auth`; Bearer header; one shared refresh on 401 | built | AC-F01 says body, never cookie |
| Sign out | `/logout` (one session) | half | Sign out everywhere missing; a password change ends **this** session too |
| Keys | `invana_pat_` + 32 bytes, sha256, `last_four`, 30/90/365/never, 20 per holder, Graph-bound, narrowed by inline policy (`core/auth/narrowing.py`) | built | AC-10; acts as the full owner unless narrowed |
| Service accounts | `users.is_service_account`, no password, member as **viewer** (spec says Operator) | built | AC-09 |
| Workers | `invana_join_` / `invana_wkr_`, sha256 | built | RT-F03 |
| Inbound MCP | Streamable HTTP (JSON only), per Graph, key only; profile keys accepted although the spec says Graph-bound only | built | RT-03 |
| Outbound MCP | Static bearer from `INVANA_SECRET_MCP_<NAME>` env, per install, no OAuth, no SSRF guard | built | RT-02 |
| SSO · MFA · SCIM · email reset | — | none | AC-01 asks for SSO; AC-F01 *Not building* defers it |
| Rate limits, lockout | none on `/login`, `/refresh`, `/admin/login`, `/mcp`; the username rate-limit setting is never read | none | NFR-SEC |

### Inbound MCP against the MCP authorization spec

| Requirement | Today |
|---|---|
| OAuth 2.1 resource server; authorization code + PKCE | absent |
| RFC 9728 protected-resource metadata, `WWW-Authenticate: Bearer resource_metadata=…` | absent |
| RFC 8414 authorization-server metadata | absent |
| Client registration (RFC 7591 dynamic, or client ID metadata documents) | absent |
| RFC 8707 resource indicators, audience-bound tokens | absent; keys have no audience |
| Origin check; session id validated | absent; `Mcp-Session-Id` is built from the client name and never checked, so the ledger's client label can be spoofed |
| Protocol version | 3 accepted; unknown silently downgraded — the spec pins `2026-07-28` and refuses others |

### Proposed auth feature set (Access Plane)

| Feature | Holds | Class | Rests on |
|---|---|---|---|
| AC-F01 Sign in, account and sessions | Password sign-in, account, sessions: sign out here/everywhere, fresh sign-in for risky acts, reuse detection, lockout and rate limits | keep · finish | — |
| ✚ Single sign-on | OIDC sign-in, just-in-time accounts, IdP groups → teams, password sign-in off except a break-glass Admin | new spec | Q-A1 |
| ✎ Keys (from AC-F03) | Personal keys, acts as key ∩ owner, maximum expiry, Admin view of every key | keep (split) | Q-A6 |
| ✚ Connect an MCP client (OAuth 2.1) | The deployment's one MCP server as an OAuth 2.1 resource; sign-in + consent; audience-bound tokens; revoke a client | new spec | Q-A2 |
| ✚ Outside credentials | Credentials to outside MCP servers and tools: install-wide secret or per-user OAuth; encrypted (D27); revoke | new spec — CP *Plugins and MCP* | Q-A3 |

## 5. Overlaps to settle in the specs

| Overlap | Code | Recommend |
|---|---|---|
| Plan · flow · workflow · task | `apps/flows` (`Flow`, `Task`), `runtime/workflows.py`, `runtime/planning.py`, `apps/llm/planner.py`, `apps/work/plan.py`; two `Task` tables | AG-F06 names one *plan* and one *workflow*; the todo graph is not a plan |
| Sessions vs runs | `apps/sessions` vs `runtime` `TaskRun` | A session is a thread of runs; state it once in EX-F03 |
| Asks ×3 | approvals · govern requests · publish reviews · `TaskPrompt` | One ask in AC-F05; a clarifying question is EX-F05, not an ask |
| History ×3 | events · ledger · changes · query log · run touches | One chain (AC-F06); the call ledger (D24) feeds *Access usage* and *What left the platform* |
| Alerts | alert rules (ledger) vs notification rules vs PJ-F06 (records) | Ledger alert rules → *Ops alerting*; notification rules → Inbox; PJ-F06 → records |
| "Rule" ×4 | skill rules · model `validation_rules` · lens grammar · alert/notification rules | Policies have *rules*; the model has *rules*; name alert and notification ones *conditions* |
| Limits ×4 | contention · envelope · policy limits · eval budget | One *Limits* feature |
| Members ×2 | Modeller › Members and IAM › People | Directory |
| Keys ×2 | `/auth/me/tokens` and `/iam/tokens` | Keys |
| Two boards | `apps/boards.Board` vs `runtime/managers/board_open.Board` | Code rename (row) |
| "Fleet" ×2 | Agents › Fleet vs workers Fleet | Workers keep *Workers*; Fleet means agents |
| Graph ↔ model | `graph_connections.model_id` and `graph_models.graph_id` | Gone with the Graph unit |

## 6. Bugs and security (recommendation rows)

| Finding | Where | Severity |
|---|---|---|
| Account-delete guards never fire — `ConflictError(...)` built without `raise` (the last superuser can delete themselves; a Graph owner hits a 500) | `core/auth/managers/auth.py:364,370` | high |
| Default secrets: JWT secret, admin cookie secret and Fernet key fall back to fixed dev values while `env` defaults to `development` | `core/settings.py:15,18,35` | high |
| No rate limit or lockout on sign-in, refresh, admin sign-in or MCP | `server/routes/auth.py`, `server/admin/auth.py`, `server/mcp_server` | high |
| Tokens in `localStorage`, no CSP | `studio/packages/core/src/stores/auth.store.ts` | medium |
| JWT accepted in `?token=` on every route | `core/auth/deps.py:86-89` | medium |
| Access writes (policies, members, groups) accept an un-narrowed key; spec says session only | `server/iam/views.py` | medium |
| Any member reads every key's details and narrowing | `server/iam/token_views.py:32-38` | medium |
| Refresh reuse not detected; no absolute session lifetime | `core/auth/managers/auth.py:263-292` | medium |
| Outbound MCP: env bearer on every worker, no SSRF guard | `runtime/managers/mcp.py:95` | medium |
| Remote workers never load MCP plugins → MCP steps likely fail under `procrastinate` | `plugins/remote.py:123`, `cli/commands/worker.py:84` | medium (unverified by a run) |
| Revoking a narrowed key from the profile leaves its inline policy | `core/auth/managers/auth.py:519-533` | low |
| `Mcp-Session-Id` unvalidated; unknown protocol silently downgraded | `runtime/managers/mcp_server.py:59,168-186` | low |

## 7. Dead code

| Code | Why |
|---|---|
| `runtime/interpreter/lanes.py` | No importer |
| `apps/modeller/reconciler.py` (371 lines), `apps/modeller/database.py` | Only re-exported |
| `graph/connectors/base/data_types/*`, `base/constants.py`, `core/events/store.py` | Shims for one or two callers |
| `server/events/` (admin only) | Routes live in `server/routes/events.py` |
| `integrations/invana-arcadedb`, `integrations/invana-tinkergraph` | Empty packages |
| Studio *Remember me*, `/auth/register` | Does nothing · never called |
| `token_expiry_minutes`, `auth_username_available_rate_limit_per_minute` | Settings never read |

## 8. Answered — now *Decisions* in `project.md`

| # | Question | Answer | Decision |
|---|---|---|---|
| Q-A1 | SSO protocols | Deferred; no SSO now | D34 |
| Q-A2 | Who issues tokens to MCP clients | Invana, as its own OAuth 2.1 authorization server | D36 |
| Q-A3 | Credentials to outside MCP servers | Per server: shared encrypted secret or per-user OAuth | D37 |
| Q-A4 | Studio token storage | Keep localStorage, with a strict CSP and an absolute session lifetime | D35 |
| Q-A5 | Service accounts | Keep, as service users owned by people | D39 |
| Q-A6 | Key expiry | Keep *never* beside 30/90/365 days | D38 |
| Q-A7 | MFA | None | D34 |
| Q-A8 | The starlette-admin console | Keep, without default secrets | D40 |
| Q-D1 | Datasets in Postgres | A dataset is a load batch | D41 |

Recommendations raised from §6 and §7: R318 – R328 (refresh reuse and the MCP protocol pin were already R015, R205, R206).
