# Invana — how it works, feature by feature

**Invana is an agent orchestrator over a curated knowledge graph.** A Graph is a bounded domain a team
curates; agents work inside it; a person accepts what they produce.

It orchestrates the **agents** — which one takes a Todo, what it may run, what it is offered, in what
order, and who checks the result. It also **runs them itself**: one in-process runtime, an asyncio task
per run, no external infrastructure. That runtime sits behind a protocol so a deployment could
swap in a job scheduler it already operates; none has been written, and the default is the only one.

Every answer is grounded in the Graph and traceable to the records behind it; when the Graph cannot
answer, it says so.

**This folder is for people building Invana.** It is the whole record of what the product does: one
row per feature below, with the detail in [`modules/`](modules/) — a folder per module holding
`spec.md` (what the module owns, its vocabulary, its cross-feature decisions) and one file per feature
beside it. The words are pinned in [`terminology.md`](terminology.md).

It states what is true **now**, in present tense, and cites nothing outside itself. There is no
separate design record and no history of what was tried before — a decision lives with the feature it
governs.

| | |
|---|---|
| Scope | Everything below is in scope. Anything not listed is [not built](#not-building). |
| Order | The `Slice` column is the build order — see [Delivery](#delivery). |
| Sides | A feature ships when every column it needs is ✅. |
| API | The engine HTTP surface Studio and external agents call. |
| CLI | `invana …` — the entry point for anything a person runs at a terminal. Most features need none. |
| Words | Pinned in [terminology.md](terminology.md). Nothing outside it is ours. |
| **Orchestration** | [orchestration.md § 0](orchestration.md#0-the-records) — **Todo → TaskPlan → Task → TaskRun**, the model this product is moving to. A person writes a **Todo**; a **TaskPlan** (authored, generated or reused) is the flow of **Task**s that carries it out; a **TaskRun** is one execution. *Nothing a user authors is ever a Task.* A **Lens** bounds what a run may see. ⚠ **§ 0 is current; § 1–§ 3 of that file and every feature file below still describe the retired Todo · Run · Step · Workflow · Project split** |
| **The migration** | [building-engine/task-model-migration.md](building-engine/task-model-migration.md) — eight tables → the records above, column by column, with the route changes, the slices M1–M8 and what Studio ships in lockstep. **Read this before touching anything task-shaped** |
| **The runtime package** | [building-engine/the-runtime-package.md](building-engine/the-runtime-package.md) — one package walks every plan; apps reach it through protocols, never imports. The file-by-file plan, and the ~900 LOC of consolidation it pays for |
| **Governance** | [governance.md](governance.md) — **RFC, concluded.** D1–D19 settled; dispersing into [modules/govern/](modules/govern/spec.md) and the files it names. The **Lens** generalises from *which graph data* to *which participants of any layer*, addressed `layer/sublayer/name`: graph data · llm · third party · cache · human — five governed layers and one spine, plus the touch record that proves the lens held |
| Databases | openCypher — Neo4j · Memgraph · ArcadeDB. Gremlin — JanusGraph · Neptune · TinkerGraph · ArcadeDB. Adding one: [12.1](modules/graph-connectors/features/the-connector-contract.md) |
| Engine | [building-engine/](building-engine/migration-plan.md) — the bands, the file shape inside a package, the import rule, and the migration to them. Code shape, not product scope. The **record** migration is [task-model-migration.md](building-engine/task-model-migration.md), and the two are orthogonal |
| Screens | [the-screens.md](the-screens.md) — the 42 hi-fi artboards, one row each, with whether the screen is built and whether it is on the kit. How Studio is built to hold them: [building-studio/](building-studio/) |
| Status | ✅ done · 🟡 in progress · 🖼 screen built, wired to nothing ([DS15](modules/platform/features/design-system.md)) · 🔵 designed, not started · — not applicable |

---

## 1 · [Connect and model](modules/connect-and-model/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 1.1 | [Connect a database](modules/connect-and-model/features/connect-a-database.md) | One Graph ↔ one graph database; test before save | ✅ | — | ✅ | S2 |
| 1.2 | [Introspect a database](modules/connect-and-model/features/introspect-a-database.md) | Seed a draft model from what is already there | ✅ | — | ✅ | S2 |
| 1.3 | [Author a model](modules/connect-and-model/features/domain-models.md) | One model per domain, authored on its own | ✅ | — | ✅ | S3 |
| 1.4 | [Model editor](modules/connect-and-model/features/model-editor.md) | Draw the model on a canvas; staged commit | ✅ | — | ✅ | S3 |
| 1.5 | [Share a model](modules/connect-and-model/features/share-a-model.md) | Export, import, upgrade; files and git are the registry | ✅ | ✅ | ✅ | S7 |
| 1.6 | [Stitch models](modules/connect-and-model/features/stitch-models.md) | Anchors and relationships; the global model is derived | ✅ | ✅ | ✅ | S7 |
| 1.7 | [Starter models](modules/connect-and-model/features/starter-models.md) | Importable models to begin from — memory, provenance — renamed on arrival | ✅ | ✅ | ✅ | S7 |

## 2 · [Bring data in](modules/bring-data-in/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 2.1 | [Bring data in](modules/bring-data-in/features/load-data.md) | `invana records import`, `invana loader` and `invana records check` — records into a model | ✅ | ✅ | ✅ | S6 |
| 2.2 | [Inspect what landed](modules/bring-data-in/features/inspect-what-landed.md) | Imports — the journal filtered to `kind in (import, bulk)`; log, report, provenance — read-only | ✅ | — | ✅ | S6 |
| 2.3 | [Load a bundle](modules/bring-data-in/features/load-a-bundle.md) | Every dataset a manifest names, in one run; stitched once, a Task raised for a broken source | 🔵 | 🔵 | 🔵 | S15 |

## 3 · [Ask](modules/ask/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 3.1 | [Write queries](modules/ask/features/write-queries.md) | Cypher / Gremlin editor with the schema in scope | ✅ | — | ✅ | S9a |
| 3.2 | [Ask in natural language](modules/ask/features/ask-in-natural-language.md) | A question becomes a run, run by an agent | ✅ | — | ✅ | S9b |
| 3.3 | [What an answer is made of](modules/ask/features/the-answer-surface.md) | Subgraph · table · metric · chart · prose, in one answer | ✅ | — | ✅ | S9b |
| 3.4 | [Projections](modules/ask/features/projections.md) | Closed questions in, table · chart · html out — from templates | ✅ | — | ✅ | S9b→S9d |
| 3.5 | [Streaming and the workflow](modules/ask/features/streaming-and-the-workflow.md) | Steps and results paint as they arrive | ✅ | — | ✅ | S9b→S9d |
| 3.6 | [Clarifying questions](modules/ask/features/clarifying-questions.md) | Understand asks back instead of guessing | ✅ | — | ✅ | S9c |
| 3.7 | [Reasoning trace](modules/ask/features/reasoning-trace.md) | Prompt → query → records → timings, per step | ✅ | — | ✅ | S9c |
| 3.8 | [When it cannot answer](modules/ask/features/when-it-cannot-answer.md) | Retry · repair · cannot-answer · diagnosis — four distinct outcomes | ✅ | — | ✅ | S9b→S9f |
| 3.9 | [The runtime](modules/ask/features/runtime-and-adapters.md) | One asyncio task per run, in-process; a protocol so it can be swapped | ✅ | — | — | S9b |
| 3.10 | [The assistant](modules/ask/features/the-assistant.md) | One assistant on the right of every panel, with the selection in hand | ✅ | — | ✅ | S12 |
| 3.11 | [Act as](modules/ask/features/act-as.md) | A stance — a method and its declared assumptions — and the ledger of what the answer rests on | 🔵 | — | 🔵 | S-TBD |

## 4 · [Explore](modules/explore/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 4.1 | [Graph canvas](modules/explore/features/graph-canvas.md) | Pan · zoom · select · style; 100K nodes | ✅ | — | ✅ | S9b |
| 4.2 | [Boards](modules/explore/features/boards.md) | Named, saved, versioned working surfaces — drawn or declared | ✅ | — | ✅ | S9 |
| 4.3 | [Selection and the panel](modules/explore/features/selection-and-the-panel.md) | The canvas selects; the panel states the fact | ✅ | — | ✅ | S12 |
| 4.4 | [The console](modules/explore/features/the-console.md) | The rows and the query under the canvas that drew them | ✅ | — | 🔵 | S12f |

## 5 · [Agents](modules/agents/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 5.1 | [Providers and models](modules/agents/features/providers-and-models.md) | Configure an LLM endpoint per Graph; ping it; set a default | ✅ | — | ✅ | S5 |
| 5.2 | [Author an agent](modules/agents/features/the-roster.md) | Author an agent; bind provider, model and skills | ✅ | — | ✅ | S12c |
| 5.3 | [Set what an agent may run](modules/agents/features/envelope-and-budget.md) | What an agent may run, with what arguments, at what cost | ✅ | — | ✅ | S12c |
| 5.4 | [Delegation](modules/agents/features/delegation.md) | Agents that spawn agents, bounded by the parent | ✅ | — | ✅ | S12d |
| 5.5 | [Pause, resume, retire](modules/agents/features/lifecycle.md) | Pause · resume · retire; the row stays so lineage resolves | ✅ | — | ✅ | S12c |
| 5.6 | [Who spawned whom](modules/agents/features/lineage.md) | Who authored whom, who spawned whom, on what run | ✅ | — | ✅ | S12c |
| 5.7 | [How many run at once](modules/agents/features/concurrency-and-contention.md) | How many run at once in a Graph, and what happens at the ceiling | ✅ | — | ✅ | S12e |

## 6 · [Skills](modules/skills/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 6.1 | [Authoring a skill](modules/skills/features/authoring-a-skill.md) | Name · description · content · when to use | ✅ | — | 🟡 | S5 |
| 6.2 | [Offer a skill to an agent](modules/skills/features/bindings.md) | Which agent may be offered which skill | ✅ | — | 🟡 | S12c |
| 6.3 | [Where a skill was used](modules/skills/features/usage.md) | Where a skill was offered, and where it was reported applied | ✅ | — | 🟡 | S12c |
| 6.4 | [Rules](modules/skills/features/rules.md) | Graph invariants and project working rules, offered as statements | 🔵 | — | 🔵 | S12b |

## 7 · [Workflows](modules/workflows/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 7.1 | [Save a plan for reuse](modules/workflows/features/the-library.md) | Named, versioned plans — Invana's builtins among them; diff against the previous version | 🟡 | — | 🟡 | S12c |
| 7.2 | [Pick a plan, or write one](modules/workflows/features/plan-selection.md) | A template by intent; generation only when none fits | 🟡 | — | 🟡 | S9d |
| 7.3 | [Check a plan against the bound](modules/workflows/features/envelope-validation.md) | A plan is checked before dispatch, refused with the bound named | 🟡 | — | 🔵 | S9d |
| 7.4 | [Promote a plan](modules/workflows/features/promote-a-plan.md) | A plan that served becomes a template | 🟡 | — | 🟡 | S12c |
| 7.5 | [Run a workflow](modules/workflows/features/run-a-workflow.md) | Start a plan from the library with its arguments — the front door | 🔵 | 🔵 | 🔵 | S15 |
| 7.6 | [Read the catalogue](modules/workflows/features/the-catalogue.md) | The closed set of callables a plan may name — bound · args · outputs · requires | 🟡 | — | 🔵 | S12c |
| 7.7 | [Draft a plan](modules/workflows/features/draft-a-plan.md) | Fork a version into a draft, edit it on the canvas or as `manifest.yml`, publish it, retire it | 🔵 | — | 🔵 | S15 |

## 8 · [Memory](modules/memory/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 8.1 | [Evidence](modules/memory/features/evidence.md) | Offered vs applied · plan served · criteria met | 🔵 | — | 🔵 | S12c |
| 8.2 | [Recall by query](modules/memory/features/recall-by-query.md) | A planned step reads prior records and cites them | 🔵 | — | 🔵 | S9d |
| 8.3 | [Proposals](modules/memory/features/proposals.md) | The system proposes a versioned change, citing its evidence | 🔵 | — | 🔵 | S12c |
| 8.4 | [Consolidation](modules/memory/features/consolidation.md) | Accept, edit or reject in Review; the effect is measured | 🔵 | — | 🔵 | S12c |

## 9 · [Work](modules/work/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 9.1 | [Projects and tasks](modules/work/features/projects-and-tasks.md) | Write a task, assign it to a person or an agent | 🟡 | — | 🟡 | S12b |
| 9.2 | [Objectives and criteria](modules/work/features/objectives-and-criteria.md) | Goals and "done" as nodes, not paragraphs | 🔵 | — | 🔵 | S12b |
| 9.3 | [Review](modules/work/features/review.md) | One queue: questions, approvals and verdicts block; results and proposals wait | 🔵 | — | 🔵 | S12b |
| 9.4 | [Recurring tasks and conditions](modules/work/features/recurring-tasks-and-conditions.md) | A template on a cron; failure branches that say why | 🔵 | — | 🔵 | S12e |

## 10 · [Operate](modules/operate/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 10.1 | [Schedules](modules/operate/features/schedules.md) | Put a question, a task or a workflow on a cron; firings stack | 🔵 | — | 🔵 | S9.5 |
| 10.2 | [Audit and activity](modules/operate/features/audit-and-activity.md) | Every write is an event; every actor is a principal; retention lives here | 🟡 | — | 🟡 | S5.5 · S12a |
| 10.3 | [Observability](modules/operate/features/observability.md) | Query and LLM metrics, cost and latency | 🔵 | — | 🔵 | S11 |
| 10.4 | [External-agent API](modules/operate/features/external-agent-api.md) | Scoped tokens; retrieval with provenance | 🔵 | — | 🔵 | S10 |
| 10.5 | [See what ran](modules/operate/features/see-what-ran.md) | **Runs** — every run in the Graph, children nested; Imports is a filter of it | 🔵 | — | 🔵 | S14 |


## 11 · [Identity and access](modules/identity-and-access/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 11.1 | [Accounts](modules/identity-and-access/features/accounts.md) | Sign up, sign in, profile; email is the login identity | 🟡 | 🟡 | 🟡 | S1 |
| 11.2 | [Usernames](modules/identity-and-access/features/usernames.md) | The URL identity — mutable, rate-limited, never aliased | ✅ | — | ✅ | S1 |
| 11.3 | [Sessions](modules/identity-and-access/features/sessions.md) | Short access token, revocable rotating refresh | ✅ | — | 🟡 | S1 |
| 11.4 | [Membership](modules/identity-and-access/features/membership.md) | Binary access to a Graph; no roles | ✅ | — | ✅ | S1 |
| 11.5 | [Personal access tokens](modules/identity-and-access/features/personal-access-tokens.md) | A long-lived credential that carries your identity; revocable, shown once | ✅ | — | ✅ | S1 |

## 12 · [Graph connectors](modules/graph-connectors/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 12.1 | [The connector contract](modules/graph-connectors/features/the-connector-contract.md) | Four methods and a driver; everything else is inherited | ✅ | — | — | S2 |
| 12.2 | [Languages](modules/graph-connectors/features/languages.md) | openCypher and Gremlin, each written once | ✅ | — | 🟡 | S2 |
| 12.3 | [Capabilities](modules/graph-connectors/features/capabilities.md) | What this server version can hold, enforced at authoring | 🟡 | — | 🔵 | S3 |
| 12.4 | [Vector search](modules/graph-connectors/features/vector-search.md) | The database's own index, where it has one | 🔵 | — | 🔵 | S7 |

## 13 · [Platform](modules/platform/spec.md)

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 13.1 | [Design system](modules/platform/features/design-system.md) | Studio builds from `@invana/design-kit`, never beside it | — | — | 🟡 | — |
| 13.2 | [Theming](modules/platform/features/theming.md) | Light · dark · theme variants, everywhere | — | — | ✅ | — |
| 13.3 | [Command line](modules/platform/features/command-line.md) | `invana init · users · start · migrate · version · datasets · models · loader` | — | 🟡 | — | — |
| 13.4 | [Logging](modules/platform/features/logging.md) | One call at startup; plain or JSON; standard library only | ✅ | — | — | S1 |
| 13.5 | [Telemetry](modules/platform/features/telemetry.md) | Traces and metrics over OTLP, in three layers, optional | ✅ | — | — | S1 |
| 13.6 | [Admin and health](modules/platform/features/admin-and-health.md) | A generated browser over app state, and a readiness probe | ✅ | — | — | S1 |
| 13.7 | [Setup](modules/platform/features/setup.md) | Four required steps in four features — the onboarding wizard, created to answering | ✅ | — | 🟡 | S13 |
| 13.8 | [The runtime](modules/platform/features/runtime.md) | The workhorse: plan graph · frontier · signals · pools · approvals · what it emits | 🟡 | — | — | S15 |

---

## 14 · [Govern](modules/govern/spec.md)

**What a run may *see*, *use* and *send*.** [Operate](modules/operate/spec.md) answers *what
happened*; this answers *what was allowed to happen*. One `Lens` record, five governed layers, and a
touch record that makes the declaration checkable. Decisions: [governance.md](governance.md).

| # | Feature | What it does | API | CLI | Studio | Slice |
|---|---|---|---|---|---|---|
| 14.1 | [Worlds](modules/govern/features/worlds.md) | Named narrowings picked per question; name it to share it, compare two, promote one | 🔵 | 🔵 | 🔵 | S16 |
| 14.2 | [Guardrails](modules/govern/features/guardrails.md) | The bounds every run carries whatever world it is in; one object, one owner | 🔵 | — | 🔵 | S16 |

## Where the work sits

| | ✅ | 🟡 | 🔵 | — |
|---|---|---|---|---|
| API | 43 | 9 | 16 | 3 |
| CLI | 4 | 2 | 2 | 63 |
| Studio | 32 | 13 | 19 | 7 |

- Modules 1 · 3 · 4 · 5 are closed: **Connect and model · Ask · Explore · Agents**. What is left is 2.3 and 6–13.
- **Bring data in reopened at 2.3.** Its two shipped features are done; the bundle load is new scope, and it is the flow the runtime's deferred frontier, lanes and `uses` were waiting for ([13.8 §21](modules/platform/features/runtime.md)).
- Studio is no longer the lagging side for the closed four; the remaining 🟡 and 🔵 sit in Skills, Workflows, Memory, Work and Operate.

## Shipped

What has actually landed, newest first. A slice is here only when it runs from a clean checkout.

| Slice | Landed | What |
|---|---|---|
| S12e | 2026-09-09 | **Agents, closed.** The Graph's ceiling: `max_concurrent_task_runs` and a policy (`queue` · `refuse`), a slot per run with delegated children counted, a person served before a schedule, a queue with a readable position, a refusal that names the bound, and `GET …/contention` behind the counts in the settings form. The **Coordinator** is seeded as the one agent that may delegate — bounded at depth 2 and three children — so the path is reachable at last, and a child's trace nests under the step that spawned it |
| S12 (Explore) | 2026-09-09 | **Explore, closed.** The assistant: the Sessions panel moved to the right side as the `assistant` occupant of `?right=`, the canvas selection riding above the composer as a named, removable chip, and the trigger in the header's panel controls. Node expand and the canvas version-history timeline were already built; the index said otherwise |
| S9b–S9f | 2026-09-09 | **Ask, closed.** `emissions` — an answer is a record now, so it survives a reload · five result templates shipped, `accepts` checked before render, the switcher on the emission header offering what else fits and why the rest cannot · `projection_templates` and `task_prompts` with authoring · `task_runs.outcome` (`answered · cannot_answer · failed · cancelled`) · `GET …/task_runs/{id}/trace` and the trace opening from an emission's own citation · the cannot-answer card and the diagnosis drawn as different things |
| S6 | 2026-09-09 | **Bring data in, closed.** `--model` is required and names an authored model — nothing is derived from the data · per-record validation with the report grouped by reason · edges whose endpoints resolve nowhere rejected naming both · provenance (`dataset · file · record · job`) stamped on every element and read back both ways · the run is a run (`dataset-import@1`, four steps) so its trace is the step card an answer uses · Studio's read-only Datasets panel and the node inspector's provenance line |
| S7 | 2026-09-09 | **Connect and model, closed.** Portable model identity (`package_id` + `content_hash`) with export · import · upgrade on both the CLI and the API · `memory` and `provenance` starters as ordinary artefacts · `model_links` with the resolve preview and the derived global model · the staged set with discard-one, discard-all and a one-action commit · Studio's Model panel (authoring, not a browser), the Links panel, and the connection as a group inside the settings form |
| S12d | 2026-09-06 | Delegation: `spawn_agent · delegate · await_delegations · create_task` as envelope-gated steps, bounds enforced by the interpreter. **Not yet exercised end to end against a live provider** — no seeded agent allows them |
| S12c | 2026-09-06 | Agents with lineage and bounds · roster, lineage and activity routes · pause / resume / retire with the open-task preview · the Graph default · skill usage · the workflow library with promote and YAML export |
| S12b | 2026-09-06 | `projects · project_assignments · tasks · todo_dependencies` · the status machine · cycle rejection naming the loop · the derived plan (waves · blocked_by · critical path) · one run per assignment · the activity tree |
| S12a | 2026-09-06 | Principals: `actor_kind` plus the causal columns · an agent event without `on_behalf_of` is refused · skills offered and applied recorded per step |
| S9d | 2026-09-06 | `understand · plan · verify` steps · the plan on the run · dispatch-time validation of plan ⊆ envelope |
| S9c | 2026-09-06 | Agents table and seeded rows · sessions and task_runs carry the agent and its version. **The external-scheduler adapter designed for this slice was never built** — the inline runtime is the only one |
| S9b | 2026-09-03 | `runs · task_runs · task_runs · task_stream` · the runtime protocol with the bundled inline adapter · todo and run API with SSE · the deterministic seeded workflow · the coarse failure classifier |
| S5 · S5.5 | earlier | Skills · LLM providers · the append-only event record with its live tail |
| S2 · S3 | earlier | Connection with test-before-save and introspection · model authoring and the canvas |
| S1 | earlier | Accounts · usernames · sessions · binary membership |

## Partly built

Where a 🟡 stops, so nobody re-derives it from the code.

| # | Feature | Built | Missing |
|---|---|---|---|
| 6.3 | Usage | Offered and applied recorded per step | The usage surface and skill versions |
| 7.1 | The library | Library list and detail | Served rate, match counts, and the diff view |
| 9.1 | Projects and tasks | Tables, status machine, derived plan, activity tree | The live step list on a task; `needs_input` rendering; cross-project dependencies |
| 11.1 · 11.3 | Accounts · Sessions | Users, bcrypt, JWT access and refresh, superuser-provisioned register, `invana init` | Account self-service edge cases — sole superuser and owns-a-Graph refusals; the profile tabs |
| 13.1 | Design system | Themes, the kit at `0.0.20`, the shared panel skeleton, the emission card with its six bodies, the projection picker, and the cannot-answer and diagnosis cards | The surfaces modules 6–13 still need — see each feature's own row |
| 13.3 | Command line | `invana init` | `start · migrate · version` as documented |
| 13.7 | Setup | The six derived steps, the three gates as route dependencies, the provider's remembered ping, the board on the graph page, the Info panel's timeline, and the Assistant's lock | Locks on the other gated surfaces (Explorer, Model, Imports), and the four artboards |


## Retiring

Shipped code that is on its way out. Listed so nobody mistakes it for scope, or deletes it before its
replacement lands.

| What | Replaced by | Goes when |
|---|---|---|
| `/modeller` as its own route | [1.4 Model editor](modules/connect-and-model/features/model-editor.md) as a board kind | The next major. The canvas is reachable from the one page now, so the route is three lines of redirect kept for bookmarks — a 404 would be a worse answer than the panel the bookmark meant |
| `pages/graphs/modeller/ModellerPage.tsx` | The Model panel and the model canvas | Nothing imports it. Its *components* stay — the panel and canvas compose them |


## Not building

- Write-back to a source · fuzzy entity resolution · node merge on an anchor
- Source connectors, cursors and a mapping grammar — Invana is a destination, not an extractor
- Roles beyond membership · invitations · soft deletes · undo
- Simulation · parameter sweeps · game theory (post-1.0, `../../system-design.md`)
- Per-element canvas styling · workflow authoring UI · criterion weights and waivers

## Delivery

| Slice | Lands | Done when |
|---|---|---|
| S1 | 11.1–11.4 | An account signs in and reaches a Graph it belongs to |
| S2 | 1.1 · 1.2 | A Graph binds to a database and shows its schema |
| S3 | 1.3 · 1.4 | A model is authored, staged and committed from the canvas |
| S5 · S5.5 | 5.8 · 6.2 | Skills and rules ground a call; every write emits an event |
| S6 | 2.1 · 2.2 | A dataset imports against its model and is inspectable |
| S7 | 1.5 · 1.6 | Two domain models stitch and answer as one |
| S9a–S9f | 3.1–3.7 · 4.1 · 4.2 | A question runs as a run, streams, traces and fails honestly |
| S9.5 | 6.1 | A question on a cron, with a diffable timeline |
| S10 · S11 | 6.3 · 6.4 | External retrieval with provenance; metrics and cost |
| S12a–S12e | 4.3 · 4.4 · 5.1–5.7 | An agent works a task and a human accepts it against criteria |
| S12f | 4.5 | The records and the query behind a drawing are readable under it, and the Explorer drives the shell's own regions |
| S13 | 13.7 | A new Graph opens on its Setup page, four derived steps close it, and the first answer needs nothing that was not named |
| S14 | 10.5 · 2.1 · 2.2 | Every run in the Graph reads from one journal, delegated children nest under their parent, and Imports is a filter of it rather than a second implementation — `import_jobs` is gone, and a load is dispatched by the interpreter like every other run ([BD12](modules/bring-data-in/spec.md)) |
| S15 | 13.8 · 2.3 · 7.5 | A plan is a graph, the cursor is a frontier, a step fans out into lanes, a pool stops one workflow starving the rest, and a person is asked before a gated step runs — proven by a bundle load that branches, fans out and inlines the single-dataset plan, and startable from the library without phrasing a question |
| S16 | 14.1 · 14.2 · 10.5 | **The lens governs five layers, and the run proves it.** A world narrows what a run may see, use and send; a guardrail refuses before dispatch; and the touch record shows which participants were read, called, refused and sent to. Done when the same question, run in two worlds, gives two answers whose difference is readable as a diff of what each touched — and when narrowing `Deal.revenue` out of a world means no query can return it, no aggregate can reveal it and no prompt can carry it |

#### S16 is ordered inside itself, and two of its steps are not in Govern

The Lens is a Studio surface over engine work that lives in **other modules' shipped features**.
Those come first, in this order:

| # | Lands in | What |
|---|---|---|
| 1 | [domain-models](modules/connect-and-model/features/domain-models.md) — 1.3 | a published model version declares its `time`, `geo` and `dims` axes. **Only declared axes are selectable** ([GV14](modules/govern/spec.md)) — without this a selector has nothing legal to name |
| 2 | [the-connector-contract](modules/graph-connectors/features/the-connector-contract.md) — 12.1 | `run_query` composes the effective predicate into its dialect, and rewrites a whole-node return into the permitted projection ([D3](modules/govern/spec.md)). **This is the whole enforcement story** — until it lands, a lens is a display filter |
| 3 | [govern](modules/govern/spec.md) — 14.1 · 14.2 | the `Lens` record, resolution and freezing, the two panels |
| 4 | [see-what-ran](modules/operate/features/see-what-ran.md) — 10.5 | the touch record, the layer strip, `Retune` |

**Step 2 is the one to schedule first and the one most likely to slip.** It is a change to every
connector, it is dialect-specific, and nothing above it can be honestly demonstrated without it — a
world that narrows but does not enforce is the exact failure
[§4](governance.md#4-sub-worlds--narrowing-what-a-decision-may-rest-on) calls *a display filter
wearing a bound's name*.

### Sequencing rules

- Don't start a slice until the previous one is reproducible from a clean checkout.
- Build Engine and Studio together — a feature is not done on one side.
- A feature not listed here is out of scope; change this file before building it.
- **Every Studio surface is built now, ahead of its slice** — see [The screen-first pass](#the-screen-first-pass).
  A screen whose engine has not landed is marked 🖼 and renders an `EmptyState` naming what unlocks it
  ([DS15](modules/platform/features/design-system.md)). The slice still owns the *wiring*: 🖼 → ✅ is the
  slice's work, and a feature ships only when every column it needs is ✅.

### How a module gets built

A slice is still the ship gate — the order above does not change. A **module pass** is how the work
inside one is done: one module at a time, its whole hi-fi reconciled into its documents before any
code.

| Step | Output | Gate |
|---|---|---|
| 1 · Pull | the module's artboards, extracted locally | `python scripts/design-pull.py --only <Artboard>` |
| 2 · Reconcile | the module's `spec.md` gains **The drawn states** — artboard · feature · what it shows; each feature file's journeys and Decisions match the drawing | no code before this lands |
| 3 · Engine | every `API` column the module needs | tests pass, coverage holds |
| 4 · Studio | the surfaces, composed from the kit, against the artboard | the screen matches the drawing |
| 5 · Close | index columns flipped, changeset written, the module's **Partly built** rows deleted | reproducible from a clean checkout |

| Rule | Detail |
|---|---|
| The drawing does not reach the code directly | Mock → document → code. What the hi-fi shows is written into the feature file first; the file is what the code is built from |
| Every artboard is cited | A module spec names the artboards that draw it, the way [Ask §7a](modules/ask/spec.md) does. An artboard nothing cites is a decision nobody made |
| A drawing that contradicts a decision | The document wins or the document changes — in the same turn, before the screen is built |
| The kit comes first | [13.1](modules/platform/features/design-system.md) blocks most Studio columns; a module pass that needs a missing component adds it upstream, it does not work around it |

### The screen-first pass

The forty-two artboards are the Studio backlog, built together rather than one per slice
([DS14](modules/platform/features/design-system.md)). The reason the old rule flipped: `@invana/design-kit`
`0.0.23` closed the component gap that made a screen expensive, so the screen is now the cheap half —
and building them one slice at a time is what lets forty-two screens grow forty-two shells.

The artboard → route → feature map, the order, and what each screen still needs live in
[building-studio/refactor-plan.md](building-studio/refactor-plan.md); what each screen composes from is
[building-studio/design-kit-coverage.md](building-studio/design-kit-coverage.md); what every **canvas**
surface composes from is [building-studio/canvas-ui-coverage.md](building-studio/canvas-ui-coverage.md);
and every screen's own status is [the-screens.md](the-screens.md).

| Rule | Detail |
|---|---|
| One shell, then screens | [DS16](modules/platform/features/design-system.md) — `Themes/AppV2 › ExplorerShell` is the contract. No screen is built until the Explorer drives the shell's regions, or every later screen inherits a workaround |
| Delete before you multiply | [DS17](modules/platform/features/design-system.md) — the five Studio-local shell components and the Studio-local answer surface go first. Building forty-two screens on a parallel component layer makes that layer permanent |
| canvas-ui first | [canvas-ui-coverage.md](building-studio/canvas-ui-coverage.md) CU1 — a canvas panel, toolbar or card is `@invana/canvas-ui`'s. Read the map before writing one; a surface listed there is consumed, never reimplemented |
| Mock → document → code still holds | The artboard is written into the feature file before the screen is built. What changes is *when*, not the order |
| 🖼 is not ✅ | A screen wired to nothing renders `EmptyState` naming its endpoint. It fabricates no rows, counts or timings ([DS15](modules/platform/features/design-system.md)) |
| The risk, named | A screen built against an unwritten API encodes a guess about its shape. The guess is cheap to correct while the screen is `EmptyState` + layout, and expensive once it has forms and tables bound to it — so a 🖼 screen stops at the layout and the empty state, and the data-shaped parts of it wait for the engine |

### The hi-fi

| | |
|---|---|
| Canvas | *Agents at Work Wireframes* — `claude.ai/code/artifact/58f2e380-ef59-41cd-8c96-d3dc7ddd06e4` |
| Pages | **Hi-fi · finance** (42 artboards, 1440×900) · Wireframes · Features · index · Considered · not building |
| In the repo | Nothing. `scripts/design-pull.py` extracts artboards into `.design/`, which is gitignored — the canvas is the source, `.design/` is a cache |
| Not drawn | **30 of the 65 features have no artboard** — they ship from their feature files alone. Whole modules: [11 Identity and access](modules/identity-and-access/spec.md) · [12 Graph connectors](modules/graph-connectors/spec.md). Plus 1.2 · 1.5 · 1.7 · 3.1 · 3.5 · 3.7 · 3.9 · 4.5 · 5.7 · 6.2 · 7.3 · 7.4 · 8.1 · 8.2 · 10.2 · 10.4 · 13.1 · 13.2 · 13.4 · 13.5 · 13.6. The list this line used to carry named four; the full reckoning, and which artboard draws each of the other 35, is in [the-screens.md](the-screens.md) |
| Screen status | Every artboard's own status — does the screen exist, is it on the kit — is [the-screens.md](the-screens.md), the screen index beside this one. `Studio` here answers "does the feature work"; that file answers "does the drawing exist yet" |
