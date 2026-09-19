# Migration plan

**The engine's code shape, and how the code gets there.** Sibling to
[building-studio/code-shape.md](../building-studio/code-shape.md) — that says how Studio is laid out;
this says how the engine is, and what still has to move. Neither says what the product *does*: that is
[README.md](../README.md) and the feature files under [modules/](../modules/).

| | |
|---|---|
| Covers | `engine/src/invana/` — the bands, the file shape inside a package, the import rule, how both are enforced, and the measured distance from here to there |
| Does not cover | what any feature does. A package is code; a module is a product idea. They are two maps |
| **Part one — the standard** | §1–§10. **Normative and permanent.** It outlives the migration, and it is what [engine/CLAUDE.md](../../../engine/CLAUDE.md) points at |
| **Part two — the migration** | §11–§24. **Measured and temporary.** Delete it when the last package converts; nothing in it is a rule |
| Measured | 2026-09-15, on the tree at `c62a7ef8` |
| Method | AST for the import graph and for route handlers · `select(<Model>)` adjacency for query sites · `wc -c` per file |

> **Scope.** This file is about **where code lives** — bands, packages, the import rule.
> The **records** are migrating too, and that is a separate plan:
> [task-model-migration.md](task-model-migration.md) — eight tables into
> [orchestration § 0](../orchestration.md#0-the-records)'s Todo · TaskPlan · Task · TaskRun · Lens.
> The two are orthogonal and can proceed independently; where both touch a package, the record
> migration's slice order wins.

## The rule this migration may not break

> **The REST API does not change.** Not a route path, not a request field, not a response shape, not a
> status code, not a query parameter. Studio is built against this surface and must keep working with
> **no frontend change at all**.

Everything here is a **file move and an internal reshape**. A manager is the same code in a different
place; a queryset is the same `select()` behind a name; `server/<module>/views.py` serves the identical
path its `routes.py` served before.

| Consequence | |
|---|---|
| `action` keeps its name and its 119 imperative verbs | it is a response field and a query parameter — [§8.1](#81-three-words-three-things) |
| `?action_prefix=` and every other parameter survive | renaming one is an API change with no measured gain |
| Column drops are **schema-only** | `skill_ids` and `run_step_id` have 0 and 1 call sites, and neither is serialised — verify that before dropping, not after |
| `invana.graph.connectors.*` does not move | a published Python API in five pip packages, and a stored value in `connections.connector_class` |
| The guards prove it | the same four that carried phases 0–4 — [§21](#21-guardrails) |
| **A view's docstring is the endpoint `description`** | FastAPI publishes it into the schema, so it is API surface. Moving a handler's prose to its manager **changes the API**. Keep the docstring on the view; the guard catches it if you forget (it did, on step 1) |

**Anything needing a coordinated Studio change belongs to a second migration, not this one.** That
includes improving the API's own shape, the dataflow story, and the endpoints a feature *should* have
had. Write them down when they come up; do not smuggle them in here.

---

# Part one — the standard

*Normative. This half survives the migration.*

## 1. Two maps of the same territory

| Map | Answers | Lives in | Organised by |
|---|---|---|---|
| **Product modules** | what can a person do | `docs/for-developers/modules/` | the user's goal |
| **Engine packages** | what owns this code | `engine/src/invana/` | dependency direction |

They do not match one-to-one and should not be made to. `modeller` serves three product modules;
Platform's runtime is one package; Ask's tables are walked by it. **Forcing the trees to mirror each
other would distort both** — what a module needs is a stated correspondence (§6), not a shared shape.

## 2. The bands

Six bands, seven top-level entries.

| L | Band | Path | May import |
|---|---|---|---|
| 0 | **Core** | `core/` — infrastructure | only other parts of `core` |
| 1 | **Graph engine** | `graph/` — the drivers | `core` |
| 2 | **Apps** | `apps/` — one folder per product domain | 0–1, and other apps **acyclically** |
| 3 | **Runtime** | `runtime/` (today `run/`) | 0–2 |
| 4 | **Activity** | `activity/` — the tree · notifications | 0–3 |
| 5 | **Edge** | `server/` · `cli/` | anything below |

**`activity` names the band and the tree both, and that is deliberate** — the same way `apps/graphs`
holds the Graph *and* membership *and* connections. A package name here is the anchor concept, not an
exhaustive description.

> One guard, so [§14.1](#81-three-words-three-things) does not rot: **in
> product copy, in [terminology.md](../terminology.md) and in every API response, *Activity* still means
> the tree of events and nothing else.** The band is a folder name; it does not widen the word.

Band 4 exists for a measured reason: **13 imports run upward from `apps/` into `runtime/` today**, and
the activity tree is why — joining events, agents, skills and run steps, it fits in neither band.
[§15.4](#134-activity-is-above-runtime-not-beside-it--and-that-is-measured).

**`graph` is top-level by design, not by exception.** It is the graph *engine* — it speaks Cypher and
Gremlin to a database and has no idea what a model, a dataset or a Graph means to the product. That
is a different kind of thing from `core`'s configuration and identity, and a different kind again
from an app. It earns its own band.

`graph` and `graphs` are now unambiguous by position: **`invana.graph` is the engine,
`invana.apps.graphs` is the application layer** — the Graph a user creates, its members, its settings.

**The band is in the import path.** `from invana.apps.agents…` inside `core/` is wrong at a glance,
before any linter runs — which is most of why the folders are worth the extra path segment.

| Band | Holds | Does not hold |
|---|---|---|
| Core | configuration, the ORM base, log setup, metrics, identity, the event record, the notification channels | any product rule, and **no routes** |
| Graph engine | speaking Cypher and Gremlin to a database: the connector contract, the six drivers, the two languages | deciding *what* to ask, or what an answer means |
| Apps | one product idea each — its models, querysets and managers (§5) | dispatch, routing, or HTTP |
| Runtime | walking a plan — planner, interpreter, catalogue, executor, artifacts, stream | what a plan means to the product |
| Activity | what follows *from* a write — the tree, and telling people about it | doing the write, firing work off it, or serving it over HTTP |
| Edge | views, routes, dependency wiring, the CLI | any rule worth testing without a request |

### 2.1 Inside `core`

```
invana/core/
  settings.py · db.py · utils.py     configuration, the session factory
  models.py                          Base — and nothing else
  migrations/                        alembic
  logging/  telemetry/               log setup, metric instruments
  graph/                             the graph-database drivers: Cypher + Gremlin
  auth/                              identity: users, passwords, JWT, personal access tokens
  events/                            the append-only record — the write path and the table
  alerting/                          channels: in-app · email · webhook. Delivery and its record
  contracts.py                       protocols, so two packages that need each other import neither
```

Order holds inside `core` too: `settings · db · models` → `logging · telemetry` → `graph` → `auth` →
`events` → `alerting`. Nothing in `core` imports upward, and nothing in `core` imports sideways past
that order. `contracts.py` sits outside the order — it is protocols and imports nothing at all.

| Part | Is core because | Is not core's job |
|---|---|---|
| `graph` | it speaks a wire protocol to a database. It has no idea what a model or a dataset is | deciding *what* to ask — that is `modeller` and `runtime` |
| `auth` | who someone is, and proving it | **who may reach which Graph** — membership is a Graph relation, and lives in `graphs` |
| `events` | the append-only write path and the table | **the activity tree** — resolving principals and nesting runs is a reader, and it is an app |
| ~~`alerting`~~ | **Superseded** — the package is called `notifications` and it sits in band 4, not core: fan-out has to resolve *who* and *why* across `apps` and `runtime`. The channels alone (SMTP, webhook, the in-app row) stay core-shaped and move down if a second caller appears. [§15.7](#137-the-shape) | |
| `contracts.py` | a protocol imports nothing and decides nothing. It is the cheapest place both sides can reach | the implementations. Those live where the behaviour is |
| `telemetry` · `logging` | every band emits; none of them may be imported back | shaping or shipping — that is [13.9](#) |

The same cut appears three times, and it is the one to hold: **`core` does the thing; an app decides
it should be done.**

| Core does | An app decides |
|---|---|
| `auth` proves who you are | `apps/graphs` decides which Graph you may reach |
| `events` writes the record | `activity/` reads it into a tree |
| `notifications` sends the email | a notification rule decides an email is warranted |

### 2.1.1 "Common" is not "core"

The question that reaches for `core/` is usually *"this is shared, so shouldn't it live low?"* — and
the answer is no, because the bands are about **direction, not reuse**.

> **`core` is not shared code. `core` is the layer that depends on nothing above it.** A cross-app
> reader is shared by every app and still cannot be core, because it depends on them.

| Test | Core | Not core |
|---|---|---|
| As the product grows, this gets | **smaller** per feature | larger with every new subject |
| It knows about | tables, drivers, identity, transport | what a Task, an Agent or a Skill *is* |
| A new app means | nothing changes here | another case to handle |

The worked example is the activity tree. It is shared by every app, and it imports `apps.agents` ·
`apps.skills` · `runtime` to name the things it prints — two of the five targets contract 1 forbids.
Shared, and high. So it is `activity/`, not `core/activity` — and band 4 rather than `apps/`, because `runtime` is band 3 and an app may not import upward ([§15.4](#134-activity-is-above-runtime-not-beside-it--and-that-is-measured)).

**A cross-app read that belongs to no single app gets its own app** — the same answer as
`apps/setup` ([§14.1](#141-the-headline--four-cycles-close-with-an-app-not-a-protocol)).
Band 2 → band 2 is legal; nothing imports it, so no cycle forms. Ignoring this is how `core/` becomes
a second application.

### 2.2 The target tree

Twenty-two top-level packages become **seven entries**, and each is a band. Inside a package, the
four roles of §5 — `models` · `querysets` · `managers` · `schemas`.

```
engine/src/invana/
│
├── core/                     ── band 0 · imports nothing outside core · no routes
│   ├── settings.py
│   ├── db.py                     the session factory
│   ├── utils.py
│   ├── models.py                 Base — and nothing else
│   ├── migrations/               alembic
│   ├── contracts.py              protocols · RunOpener · EnvelopeCheck
│   ├── logging/                  13.4
│   ├── telemetry/                13.5 · instruments, exporters
│   ├── auth/                     §11 · identity — users, passwords, JWT, PATs
│   │   ├── models.py  querysets/  managers/  schemas.py
│   └── events/                   10.2 · the record, and nothing that reads it
│       ├── models.py             Event · the generic (target_kind, target_id)
│       ├── querysets/            event.py
│       ├── managers/             emit · redact · retain
│       ├── registry.py           subject descriptors · populated by server/, never by core
│       └── notify.py             the LISTEN/NOTIFY daemon and its broadcaster
│
├── graph/                    ── band 1 · the graph engine · §12
│   ├── connectors/
│   │   ├── base/                 the four-method contract + querysets/
│   │   ├── cypher/               neo4j · memgraph · arcadedb
│   │   └── gremlin/              janusgraph · neptune · tinkergraph
│   └── languages/                openCypher · Gremlin, written once
│
├── apps/                     ── band 2 · one folder per product domain
│   ├── graphs/                   the Graph entity, and membership
│   ├── modeller/                 §1 · models, introspection, links, portability
│   ├── canvases/                 4.2
│   ├── explorer/                 §4 · no models → no querysets
│   ├── datasets/                 §2
│   ├── sessions/                 §3
│   ├── skills/                   §6
│   ├── agents/                   §5 · roster, envelope, budget, delegation
│   ├── workflows/                §7 · the library
│   ├── work/                     §9 · projects folds in at §7 step 6
│   ├── projects/                 §9 · flat until that merge names the parts
│   ├── llm/                      5.1 · providers fold in at §7 step 6 · no models
│   └── llm_providers/            5.1 · flat until that merge names the parts
│                                 ── every app, inside:
│                                    models.py · schemas.py
│                                    querysets/<model>.py      one per model
│                                    managers/<capability>.py  the rules, as classes
│                                    events.py                 its verbs + target kinds
│
├── runtime/                  ── band 3 · was run/
│   ├── planner/                  select · draft · validate
│   ├── interpreter/              the cursor, the signals, suspend and resume
│   ├── catalogue/                the closed callable set — one file per bound
│   ├── executor/                 one protocol, one implementation · pools
│   ├── state/                    task_runs · models · querysets · managers
│   ├── prompts/                  task_prompts — the three pauses
│   ├── artifacts/                task_artifacts — the digest is in the row, the payload is not
│   └── stream/                   task_stream — run frames, resumed by seq
│
├── activity/                 ── band 4 · reads every domain band · read only by the edge
│   ├── schemas.py                ActivityNode — one shape for an event and a step
│   ├── managers/tree.py          10.2 · the tree — per task, per agent, per Graph
│   └── notifications/            models · querysets/ · managers/ · schemas.py
│                                 the inbox — thread · reason · read state · rules
│                                 channels · deliveries · subscriptions
│
├── server/                   ── band 5 · edge
│   ├── app.py  deps.py           the wiring: protocols → implementations
│   ├── middleware.py  admin/
│   └── <module>/                 one folder per product module
│       ├── routes.py             paths → views. No function bodies
│       ├── views.py              parse · call one manager · serialise
│       └── deps.py               graph resolution, membership guards
└── cli/                          13.3
```

`runtime/` stays at the top level rather than under `apps/`: it imports every app, so it is not one.
Its full tree, the protocol direction that lets `skills` and `sessions` call it without importing it,
and the file-by-file plan are [the-runtime-package.md](the-runtime-package.md).
`graph/` stays at the top level because it is the engine, not a domain — nothing in it knows what a
Graph is to a user.

**`contracts.py` is a file, not a band.** Two protocols do not need a package, and `core` is already
the one place both sides can reach.

**`core/events` holds the record and nothing that reads it.** The table, the write path, redaction,
retention and the tail daemon are core. The tree, the inbox and the rules are band 4, because they
resolve *who* and *why* across `apps` and `runtime`.

**`activity/` is the one new band**, and unlike `apps/` it has a defect behind it: **13 imports run
upward from `apps/` into `runtime/` today**, and the tree is why — joining events, agents,
skills and run steps fits in neither band.
[§15.4](#134-activity-is-above-runtime-not-beside-it--and-that-is-measured).
The name is the lean, not yet settled — [§15.6](#136-what-the-band-is-called).

**`apps/` is ergonomics, and the doc should say so.** It kills no cycles and fixes no measured
problem. What it buys is that the band is visible in the import path — `from invana.apps.agents…`
inside `core/` is wrong at a glance, before any linter runs. What it costs is that every import in the
codebase changes once. Worth it, but it is the one move here with no defect behind it, which is why
it is scheduled last (§7).

### 2.3 What moves, and where it lands

| Today | Becomes | Why |
|---|---|---|
| `settings.py` · `db.py` · `utils.py` | `core/` | foundation, and nothing imports them back |
| `logging/` · `telemetry/` | `core/logging` · `core/telemetry` | every band emits; neither may be imported back |
| `graph/` | **stays `invana/graph`** | its own band. The graph engine is not infrastructure and not a domain |
| `auth/` | `core/auth` | **minus** the membership check, which moves to `apps/graphs` |
| `events/` | `core/events` | **minus** `routes.py` → `server/routes/`, and minus the read-time `Agent` lookup |
| `modeller/models.py` `Base` · `modeller/migrations/` | `core/models.py` · `core/migrations/` | the single change that kills ~13 cycles |
| `modeller/` (the rest) | **`apps/modeller`** | introspection, links, inheritance, portability — real domain |
| `graphs/` | **`apps/graphs`** | the Graph entity. No longer a near-homonym of the drivers |
| `work/activity.py` | **`activity/`** | the tree is a cross-app read, not a Work rule. [10.2 C6](../modules/operate/features/audit-and-activity.md) needs three — per task, per agent, per Graph — and only one could live in `work`. **Band 4, not `apps/`**: it imports `runtime.models`, which band 2 may not ([§15.4](#134-activity-is-above-runtime-not-beside-it--and-that-is-measured)) |
| every `services.py` | `managers/` — classes, not free functions | 13 files, 179 loose functions, 0 classes. §5 |
| every `store.py` | `querysets/<model>.py` | already the right layer under the wrong name, for 21 of 39 models. §5 |
| every `routes.py` under `apps/` · `runtime/` | `server/<module>/{routes,views}.py` | 14 files. An app is a Python API; HTTP is one front-end over it. §5 |
| `core/events/actions.py` | `apps/<app>/events.py`, one per app | 122 verbs + 19 target kinds for 21 subjects, in one `core` file. A feature must ship without touching `core` |
| — | `core/events/registry.py` | new · subject descriptors, populated by `server/` at startup. **Registration, not import** — core may not reach an app |
| — | `activity/notifications` | new · the inbox and its delivery. Replaces the planned `core/alerting` |
| `canvases` · `explorer` · `datasets` · `sessions` · `skills` · `agents` · `task_plans` | `apps/…` | already at the right band; they gain a path segment and lose nothing |
| `llm_providers/` | `apps/llm_providers`, then folded into `apps/llm` at §7 step 6 | one calls a model, the other stores the endpoint. One app — but `llm/providers/` is already the four provider *clients*, so which half keeps the name is the merge's decision, not the move's |
| `projects/` | `apps/projects`, then folded into `apps/work` at §7 step 6 | they import each other and hold the same idea |
| `run/` | `runtime/`, split into seven parts | [13.8 §2](../modules/platform/features/runtime.md) |
| every `routes.py` in `core` | `server/routes/` | a route needs a request, a user and a Graph |
| — | `core/contracts.py` | new · two protocols |
| — | `activity/notifications` | new · band 4. **Deferred** — see §7, blocked on a Notifications feature file |

**The `graph` / `graphs` ambiguity is resolved by position**: `invana.graph` is the engine that speaks
to a database; `invana.apps.graphs` is the application layer — the Graph a user creates, its members,
its settings. Different bands, different depths, and no rename needed.

## 3. The rule

> **A package may only import from a lower band, and never upward.**
>
> Which collapses, for the part that matters most, to one sentence a linter checks and a contributor
> remembers: **`core` imports nothing from `invana` that is not `core`.**

Sideways is the one place the rule bends, deliberately. Apps do import each other — `work` needs
`agents`, `modeller` needs `datasets` — and forcing every one of those through a protocol would buy
nothing but indirection. So:

| Between | Rule |
|---|---|
| bands | strictly downward |
| apps | edges allowed, **cycles are not** |

Acyclicity is the checkable half, and it is the half that matters: a cycle is what makes a package
untestable alone.

Two consequences worth stating plainly, because they are what the rule buys:

| | |
|---|---|
| Every layer is testable alone | `graph` needs a database and nothing else. `runtime` needs no HTTP. A rule worth testing is never behind a request |
| The backend is buildable without Studio | The edge is one layer. Everything under it is exercised by the CLI and by tests, which is why a feature can be finished and debugged before any screen exists |

### 3.0 What blocks the move into `core`, measured

Three imports, in three files. That is the whole distance.

| Part | Today imports | Verdict |
|---|---|---|
| `graph` | `telemetry` only | ✅ clean — and **staying top-level**, see below |
| `logging` · `telemetry` | nothing, and `settings` | ✅ clean |
| `auth` | `events` ✅ · `modeller.models.Base` ⟲ · **`graphs.models.Graph, GraphMember`** ✗ | one import, `auth/services.py:51` |
| `events` | `auth.models.User` ✅ · `modeller.models.Base` ⟲ · **`agents.models.Agent`** ✗ · **its own `routes.py`** ✗ | two, `events/store.py:14` and `events/routes.py` |

⟲ = vanishes when `Base` moves into `core/models.py`, which is step 1 anyway.

**`graph` does not move, and the design reason comes first.** It is the graph engine — its own band,
above `core` and below everything else. Folding it into `core` would have filed a database engine
next to the log configuration.

**Two constraints agree, and the second is decisive.** Five separately-versioned pip packages —
`invana-neo4j` · `invana-memgraph` · `invana-arcadedb` · `invana-janusgraph` · `invana-tinkergraph` —
import eleven distinct paths under `invana.graph.connectors.*` and `invana.graph.types.*`. **That is a
published Python API.** Moving it breaks every installed connector at import time, in packages this
repo does not release.

The first constraint is the dotted path being a **stored value**:
`connections.connector_class` holds
`invana.graph.connectors.cypher.connector.OpenCypherConnector`, the API serves it, the CLI accepts it
and admin shows it. Had the design pointed the other way, moving it would have needed a data
migration and an API value change.

> **A module path is a public identifier when it appears in data, on the wire, or in another
> package's `import`.** Frozen for the same reason a column name is. `invana.graph` is all three, and
> it is worth knowing it is load-bearing before someone tidies it.

| Blocker | Fix | Size |
|---|---|---|
| `auth/services.py` → `Graph`, `GraphMember` | **Identity is core; membership is not.** `auth` owns who someone is; `graphs` owns who may reach which Graph. Move the membership check into `graphs` | one function |
| `events/store.py` → `Agent` | It resolves an agent's *name* at read time. [10.2](../modules/operate/features/audit-and-activity.md) already specifies the opposite — *"the subject's name is captured at write"* — so this import contradicts the spec it implements. Capture the name and the import goes | one call site |
| `events/routes.py` → `auth.deps`, `graphs.deps` | **`core` has no routes.** Core is tables, drivers and services; the HTTP surface moves to `server/` | one file moved |

That last rule is worth stating on its own, because it is what keeps `core` core:

> **No package in `core` has a `routes.py`.** A route needs a request, a current user and a Graph —
> three things core is defined by not knowing.

### 3.1 Breaking the two real cycles

Most cycles are accidents of placement and disappear when `core` is extracted. Two are genuine
two-way needs, and they are broken the same way: **a protocol in a lower layer that both sides depend
on, and neither side depends on the other.**

| Cycle | Protocol, in `core/contracts.py` | Implemented by | Called by |
|---|---|---|---|
| `work ↔ runtime` | `RunOpener` — open a run for this Task | `runtime` | `work` |
| `runtime → agents` for the envelope | `EnvelopeCheck` — is this plan allowed | `agents` | `runtime` |

`server` (the edge) wires the implementations to the protocols at startup. Neither package imports the other.

**This is not speculative abstraction.** Each protocol is a couple of methods, added to break a
measured cycle — not a seam anticipating a caller who does not exist. That distinction is the whole
difference between a band and a framework, and it is the same rule the runtime applies to its own
executor ([13.8](../modules/platform/features/runtime.md)).

### 3.2 Enforcement

A layering document nobody checks decays within a quarter.

Three contracts in `pyproject.toml`, run by `import-linter` in pre-commit and CI beside Ruff:

| # | Contract | Type | Says |
|---|---|---|---|
| 1 | `core is independent` | forbidden | `core` may not import `graph` · `apps` · `runtime` · `server` · `cli` |
| 2 | `bands` | layers | `cli` · `server` → `activity` → `runtime` → `apps` → `graph` → `core`. **13 imports violate this today**, all `apps` → `runtime` ([§15.4](#134-activity-is-above-runtime-not-beside-it--and-that-is-measured)); 8 close as a side effect of moving routes to `server` |
| 3 | `apps are acyclic` | independence, with declared exceptions | no cycle among `apps.*` |

| | |
|---|---|
| Exceptions | named individually, in the config, with the cycle each one stands for. Never a blanket ignore |
| Removing one | is how a refactor step is *finished* — §7 step 9 is deleting the last of them |
| A needed new exception | means the band map is wrong. Change the map in this file first |

## 4. Inside a package

The bands say *which package owns this code*. This says *what shape a package has inside* — four
roles in the package, two at the edge, and nothing else.

| Role | File | Holds | Never holds |
|---|---|---|---|
| **Model** | `models.py` · `models/` | SQLAlchemy tables, declared against `core.models.Base` | a query, a rule |
| **QuerySet** | `querysets.py` · `querysets/` | every `select()` · `update()` · `delete()` against that model. Takes a session, returns models | a decision. A queryset answers *which rows*, never *whether* |
| **Manager** | `managers.py` · `managers/` | the rules, as a class with methods — `AgentManager.start(…)`. Composes querysets, emits events. **This is the part worth testing** | a `select()`, an HTTP type, a status code |
| **Schema** | `schemas.py` | Pydantic request and response shapes | a rule |

At the edge, one band up — `server/<module>/`, named for the [product module](#10-package--module-correspondence):

| Role | File | Holds | Never holds |
|---|---|---|---|
| **View** | `views.py` | parse the request, call **one** manager method, serialise | a rule, a `select()`, a `session.add`, an `if` that is not about HTTP |
| **Route** | `routes.py` | `APIRouter`, the paths, the dependencies, the view each path points at | a function body |

The vocabulary is Django's, because the problem is Django's: **where does a query live, and where
does a rule live.** `graph/connectors/*/querysets/` already answers it — this extends that answer to
`apps/`, `core/` and `runtime/`.

### 4.1 The two guarantees

Stated as absolutes, because a rule with a soft edge is not enforceable:

> **1 · Every SQLAlchemy query lives in a queryset.** No `select()`, `update()` or `delete()` against
> an app table appears anywhere else — not in a manager, not in a view, not in the CLI, not in a
> background task.
>
> **2 · Every rule lives in a manager, and the managers are the Python API.** `invana.apps.work.managers`
> is a supported surface an operator can import and call. HTTP and the CLI are two front-ends over it,
> and neither may hold a rule the other would need.

Which makes the dependency direction inside a package one line:

```
routes → views → managers → querysets → models
```

No arrow skips a step, and none points back.

#### The exemptions, and there are three

| Exempt | Why | Guard |
|---|---|---|
| `graph/connectors/*/querysets/` | the same word against a *graph* database, not the app database. It is the precedent, and a published API | it is already a queryset |
| `core/migrations/versions/` | a data migration is raw SQL by nature and pinned to a schema snapshot | never imported by application code |
| a queryset's own internals | obviously | — |

**Nothing else. `server/admin/` is not exempt, and `cli/` is not exempt.**

#### Two front-ends over one Python API

`server/` and `cli/` are **peers**, not a primary and a secondary. Both are band 5, both hold zero
rules, and both exist to expose the same managers:

```
                invana.apps.<app>.managers          the Python API — the capability
                        ▲            ▲
        server/  ───────┘            └─────── cli/
        HTTP: routes → views                  terminal: a command
```

| Either may | Neither may |
|---|---|
| parse input, call **one** manager method, render the result | hold a rule, run a query, or emit an event |

`cli/commands/` holds **raw `select()` in four files** today — `stitches.py` · `loader.py` ·
`datasets.py` · `models.py` — and emits events directly. That is the same defect as a view holding a
rule, and it gets the same fix. A command that needs something the API does not have is telling you a
manager is missing, not that the CLI is special — which is what makes *"the backend is buildable
without Studio"* ([§4](#3-the-rule)) true rather than aspirational.

#### `server/admin/` follows the standard like every other module

Measured: **`server/admin/views.py` contains no query at all** — 39 `ModelView` classes and 9
`can_create` / `can_edit` methods, all declarative. The only raw query in the package is
`server/admin/auth.py:54`, and it moves to `core/auth/querysets/user.py` like any other.

Two things to clean up, and neither is an exemption:

| | |
|---|---|
| **`views.py` means two things** | ours is an HTTP handler; admin's is a starlette-admin `ModelView` **declaration**. One word, two meanings, in the same folder tree |
| **39 declarations in one file, away from the code they describe** | a module's admin view belongs with that module's routes |

So each module's `ModelView` moves to `server/<module>/admin.py`, and `server/admin/` keeps only what
is genuinely global — the `Admin()` mount, the section grouping, the auth provider, the templates:

```
server/
├── admin/
│   ├── __init__.py            the Admin() mount · DropDown sections · registration
│   ├── auth.py                SuperuserAuthProvider — calls a manager, holds no query
│   └── templates/
└── skills/
    ├── routes.py  views.py  deps.py
    └── admin.py               SkillAdmin(ModelView) — beside the code it describes
```

A `can_create` that returns a constant is configuration and stays. One that **inspects state** is a
rule, and calls a manager like anything else.

> This changes the standing instruction in [engine/CLAUDE.md](../../../engine/CLAUDE.md) — *"add a
> `ModelView` in `src/invana/server/admin/views.py`"* — to *"add it in `server/<module>/admin.py`"*.
> The exclusion rule is unchanged: never expose a `*_encrypted`, `*_hash` or raw-token column.

| Rule | Detail |
|---|---|
| A rule in a view is untestable without a request | Move it to a manager and the test loses its client |
| A `select()` outside a queryset is a defect | Three exemptions, named above. There is no fourth |
| The managers are the Python API | If the CLI and a view need the same thing, it is one manager method called twice — never two implementations |
| A manager never imports `fastapi`; a queryset never imports a manager | One direction, inside the package too |
| Flat file, or folder | One model / one manager → `querysets.py` · `managers.py`. More than one → `querysets/<model>.py` · `managers/<capability>.py`. **A queryset is named for its model, a manager for its capability** |
| A file outside the vocabulary must be pure | The moment it takes an `AsyncSession` it is a queryset or a manager, and should be named one. Algorithms — `validator.py`, `envelope.py`, `encryption.py` — keep their own names and take no session |
| A package with a file over ~40 KB is a folder | `runtime/` and `core/graph/` are folders for this reason |
| Cross-app reads go through a **manager** | Never another app's `models.py`, `querysets/` or `views.py` |
| **Every HTTP surface lives in `server/`** | No `routes.py` under `apps/` or `runtime/`. The app layer is a Python API — importable, and testable, without FastAPI installed |

How far the code is from this, and the package-by-package order for getting there, is
[§12](#12-how-far-the-code-is-from-the-standard-measured) and [§16](#16-order--one-package-at-a-time-smallest-first). The four greppable checks that keep it
true are [§8.1](#161-enforcement-the-same-way-the-bands-are-enforced).

## 5. What a manager looks like

| Decision | Stated |
|---|---|
| A manager is a **class**, its methods are the capabilities | `AgentManager.start()`, not `start_agent()` |
| A manager is **stateless**; the `AsyncSession` is the first argument of every method | matches every existing `*Store` today — do not move the session into `__init__` |
| A manager holds its querysets as **class attributes**, not module imports at call sites | one place to swap them in a test |
| A manager may call **another app's manager**, never another app's queryset or model | the cross-app read rule from §12, restated at file granularity |
| A manager **never imports `fastapi`** | greppable. A manager that raises `HTTPException` is a view in the wrong file |
| A queryset **never imports a manager** | one direction, inside the package too |

## 6. Where the API lives

The app layer **is** the Python API. REST is one front-end over it, and not the only one planned —
the CLI is a second today.

```
invana.apps.work.managers.TaskManager.assign(session, task_id=…, agent_id=…)
        │                                            the capability
        ├── server/work/views.py     ── HTTP
        └── cli/commands/…           ── terminal
```

| Consequence | |
|---|---|
| Every `routes.py` under `apps/` moves to `server/<module>/` | 12 files. This **overrides [code-shape §5](#4-inside-a-package)**, which today says *"an app's `routes.py` may stay with it"* |
| `server/routes/*.py` flattens into `server/<module>/` | the 6 files there today become `server/models/`, `server/model_links/`, `server/auth/`, `server/events/`, `server/telemetry/` |
| The HTTP surface stops being in three places | `apps/*/routes.py` · `runtime/routes.py` + `template_routes.py` · `server/routes/*.py` → one |
| An app becomes importable without FastAPI installed | which is what makes it a Python API rather than a web framework's insides |

`server/<module>` is named for the **product module**, not the package — [code-shape §6](#10-package--module-correspondence)
is the join, and it is already many-to-many.

## 7. The exceptions, each named

| Package | Exception | Why |
|---|---|---|
| `graph/connectors/*/querysets/` | **stays exactly as it is.** Same word, different subject: these build Cypher and Gremlin against a *graph* database; `apps/*/querysets/` build SQLAlchemy against the app database | Both answer *"where do the queries live"*, which is the point of sharing the word. And `invana.graph.connectors.*` is a published Python API five pip packages import — it cannot move ([code-shape §4.0](#30-what-blocks-the-move-into-core-measured)) |
| `graph/` gets no `managers/` | the connector **is** the manager — it owns the rules about a live connection | there is no second layer to add |
| `apps/llm` · `apps/explorer` | **no models, so no querysets.** Managers only | an app with no table is still an app; it just has nothing to query |
| `apps/graphs/manager.py` | `GraphConnectionManager` is a **live connector pool** with a health-check loop, not business logic. Rename to `pool.py` · `ConnectionPool` | otherwise `manager.py` and `managers/` mean two unrelated things, separated only by an `s` |
| Pure modules — 13 of them | files that touch **no session**: `modeller/validator.py` · `solve.py` · `inheritance.py` · `datasets/bundle.py` · `agents/envelope.py` · `registry.py` · `graphs/compatibility.py` · `encryption.py` · `work/plan.py` · `llm/client.py` · `intent.py` · `propose.py` · `translate.py` · `grounding.py` | **They stay, under their own names.** They are algorithms, not roles. The rule they obey instead: *a file outside the vocabulary takes no session and decides nothing about permission* |

> **A file outside `models · querysets · managers · schemas` must be pure.** The moment it takes an
> `AsyncSession`, it is a queryset or a manager and should be named one. That single test sorts all
> 30 one-off files today — 13 pass, 17 do not.

## 8. Events, activity and notifications

**Status: the words are settled, the design is not.** Recorded here because the naming keeps being
re-asked; the build waits on [§14.4](#84-open).

### 8.1 Three words, three things

They are not synonyms and must not be consolidated. [terminology.md](../terminology.md) already pins
the third.

| Word | Is | Part of speech | Owns |
|---|---|---|---|
| **Event** | the row — one immutable fact | noun | `core/events` — table, write path, redaction, retention, the tail |
| **Action** | the *verb on* the row — `skill.create` | verb | the `events.action` column |
| **Activity** | the *tree read out of* events | a view | `apps/activity` ([§9.1.1](#1411-the-same-shape-again--the-activity-tree)) |

Collapsing Event into Activity would lose the distinction retention depends on: **a window purge
removes events; the tree is derived, so it simply gets shorter.**

One hazard to hold: `action` and `activity` share a stem and mean unrelated things. `Activity` is
product vocabulary and stays; **`actions` stops being a filename** (§14.3).

#### The field is `action` — not `event_type`, not `activity_type`

`project.create`, `graph.connect` and the other 120 are **values of `Event.action`**.

| Rejected | Why |
|---|---|
| `event_type` | every row is the same *type* — an Event. What differs is the verb, not the taxonomy. And `actor_kind` already spends `kind` on the polymorphic discriminator |
| `activity_type` | Activity is the **tree**. An action is not a kind of tree |

`action` is also already the public name: `?action_prefix=skill.` is a query parameter on two routes
and a field on `EventFilter`. Renaming it is an API change, and it buys nothing.

#### Tense: imperative, unless no one commanded it

Measured across the 122 constants:

| Form | Count | Examples |
|---|---|---|
| imperative | **119** | `graph.create` · `model.publish` · `task.assign` |
| past | **3** | `auth.login_failed` · `token.refused` · `connection.version_detected` |

The three are not drift. Both live ones are emitted with `actor_kind = anonymous`, and the third
(dead, [§15.2](#132-dead-weight-found-while-counting)) would be `system`:

> **Imperative when a principal did it. Past tense when the system observed it** — that is, whenever
> `actor_kind` is `system` or `anonymous` and there is no actor whose command the verb could name.

So `project.created` reads naturally in English but is the wrong form here: a person created it, so it
is `project.create`. The rule is checkable against a column, which is why it is worth keeping over
"pick one tense".

Do **not** flip the 119. `action` is public API, existing rows hold the old values, and the convention
would swap from GitHub's (`repo.create`) to Stripe's (`invoice.payment_succeeded`) for no measured
gain. Normalising tense is not on the list; splitting the file per app ([E1](#83-settled)) is.

### 8.2 The measured defect

| | |
|---|---|
| Action constants in **one file under `core/`** | **122**, across **21 subjects** |
| `emit_event` call sites | **106**, across **18 packages** |
| …sitting in `server/routes/` — a view holding a rule | **16**, removed by [§1](#4-inside-a-package) |
| `_event_detail` — one function rendering every event kind | 5 branches covering all 21 subjects |

Shipping a feature in any app means editing a file in `core`. The direction is legal; the coupling is
not the shape we want.

### 8.3 Settled

| # | Decision | Why |
|---|---|---|
| E1 | **`core` owns the base, each app owns a subclass.** `core/events` holds `Event` · one `EventQuerySet` · a base `EventManager` carrying emit, redaction, the attribution check and `trace_id`. Each app ships `managers/events.py` — `WorkEventManager(EventManager)` — declaring **its own verbs and target kinds as class attributes**, and a `describe()` for its payloads. `core/events/actions.py` is split along its 21 prefixes and deleted | a feature ships without touching `core`. The import runs **band 2 → band 0, downward and legal** — see [§14.7](#87-the-base-class-and-what-it-replaces) |
| E2 | ~~Registration, not import.~~ **Not needed.** No registry, no startup wiring | `core` never needs an app's vocabulary: emit takes the action from its caller, redaction works by field name, retention by window, and the notify daemon fans out ids. Only *rendering* needs the vocabulary, and rendering happens in the reader (band 4) and in views (band 5) — **both may import apps**. The registry only existed to work around a reader living in `core`; [§15.4](#134-activity-is-above-runtime-not-beside-it--and-that-is-measured) moved the reader out, and the problem went with it |
| E3 | **Emission belongs to the manager that does the write**, never to a view | falls out of [§1](#4-inside-a-package) at no extra cost |
| E4 | **The transport already exists.** Migration `00000000000d_events.py` installs an `events_notify_insert` trigger firing `pg_notify`; `core/events/notify.py` LISTENs and fans out to subscribers. Today there is one subscriber — SSE. **Notifications are a second one** | it already fires after commit, already runs outside the request path, and already works across worker processes |
| E5 | **A notification is not an event.** It is a *thread with unread state* that events bump — carrying a coalescing key, a reason and read state, not an `event_id` | 50 writes on one Task must produce one bumped row, not 50. This is the difference between an inbox and a spam machine |
| E6 | **The reason is computed at fan-out and stored** | why someone was notified cannot be reconstructed later, once subscription state has moved on |
| E7 | **Deciding and delivering are separate concerns, not separate packages** | a rule decides, a channel delivers — both inside `activity/notifications` ([§16.3](#93-automations-dissolves--there-is-no-such-package) dissolved the third package) |
| E8 | **One table, one queryset; many verbs, many managers.** Apps subclass `EventManager`, never `EventQuerySet` | every app queries the same `events` table, so there is nothing per-app to filter differently. Only the vocabulary differs, and the vocabulary lives on the manager |
| E9 | **The per-app subclass writes; it does not read.** It is `EventManager`, **not** `ActivityManager` | [§14.1](#81-three-words-three-things): Activity is the *tree*, and the tree is cross-app and band 4. A per-app class called `ActivityManager` would put the word back on both sides of the line this section exists to draw |

### 8.4 Open

| # | Question | Lean |
|---|---|---|
| N1 | ~~`alerting` or `notifications`~~ | **Settled: `notifications`.** *Alerting* collides with [10.3 Observability](../modules/operate/features/observability.md)'s monitoring language, and *notifications* is the in-app surface's real name. It lives in the band [§15.4](#134-activity-is-above-runtime-not-beside-it--and-that-is-measured) names, **not** `core` — [code-shape §3.1](#21-inside-core)'s `core/alerting` is superseded |
| N2 | **What is the coalescing key** — the thread that events bump | **`Task` and `Run`.** Those are what a person watches; `Session` and `Graph` are scopes, not threads |
| N3 | **What are the reasons**, and how do they rank when several apply | derive from what is already stored: *created the task* · *assigned to it* · `on_behalf_of_user_id` of the run · *explicitly watching* |
| N4 | **Is webhook delivery at-least-once** | **yes — a `notification_deliveries` table** with attempt count, response, backoff and auto-disable. [code-shape §3.1](#21-inside-core) already implies it ("retrying, recording the outcome"). At-most-once is fine for in-app, not for a third party |
| N5 | **Dev without Postgres** — SQLite has no `LISTEN/NOTIFY`, so E4's transport has no dev path | an in-process fallback, or notifications are Postgres-only in dev |

### 8.5 Blocked

**13.10 does not exist.** [code-shape §3.2](#22-the-target-tree) references `core/alerting`
and `apps/automations` as 13.10. **13.10 is no longer needed** —
[§16.3](#93-automations-dissolves--there-is-no-such-package) folds its notify half into
`activity/notifications` and its run half into [10.1 Schedules](../modules/operate/features/schedules.md).
What is still missing is a **Notifications** feature file and its row in [README.md](../README.md); by
[CLAUDE.md rule 1](../../../CLAUDE.md), none of §14.3 or §14.4 may be built until those land.

### 8.6 The shape, once N1–N5 are settled

```
core/events/            the row      — table, write path, redaction, retention, the tail daemon
                                       one EventQuerySet · a base EventManager (E1) · no registry (E2)
activity/               the read     — the tree across apps (§9.1.1) · band 4
activity/notifications/ the inbox    — thread · reason · rules · channels · deliveries
apps/<app>/events.py    per app      — its verbs, and how to describe one (E1)
```

One stream, three consumers: **SSE** (built) · **the tree** (exists, wrong package) · **Notifications**
(new, and mostly a subscriber registration).

### 8.7 The base class, and what it replaces

```
core/events/                                band 0
  models.py        Event · the generic (target_kind, target_id)
  querysets.py     EventQuerySet            one table → one queryset (E8)
  managers.py      EventManager             emit · redact · attribution · trace_id
                                            — knows no app, and never will

apps/work/managers/events.py                band 2 → imports band 0 · downward · legal
  class WorkEventManager(EventManager):
      TARGET = "task"
      verbs:  task.create · task.assign · task.result · …
      def describe(event) -> str            how a Work payload reads

activity/                           band 4 → imports apps · downward · legal
  the tree, calling each app's describe()   no registry needed (E2)
```

| Replaces | With |
|---|---|
| `core/events/actions.py` — 122 verbs + 19 target kinds for 21 subjects | ~21 subclasses, each holding its own |
| `emit_event(action=actions.TASK_ASSIGN, target_kind=…, …)` at 106 call sites | `WorkEventManager.assigned(session, task, to=…)` — typed to the app's own verbs |
| `_event_detail` — one function branching over every subject | `describe()` on each subclass |
| 16 `emit_event` calls sitting in `server/routes/` | gone: a view calls a manager, and the manager emits ([§1](#4-inside-a-package), E3) |
| 11 dead constants ([§15.2](#132-dead-weight-found-while-counting)) | deleted with the file |

**Two risks worth naming.** Inheritance attracts shared behaviour: keep it **one level deep**, and put
anything a second app needs on the base or in a plain function, never in a sibling. And the subclass is
a *writer* — the moment someone adds a `tree()` method to it, the band line has been crossed (E9).

## 9. The models

What tables this needs, and which band owns each. **`events` exists; everything else is new and most
of it is blocked** — see [§16.5](#95-what-is-blocked).

### 9.1 The record — `core/events`, band 0

One table, and it is already there. The changes are subtractions:

| Column | Today | Change |
|---|---|---|
| `id` · `created_at` | ✅ | — |
| `action` | ✅ `String(64)` | keep. [§14.1](#81-three-words-three-things) — not `event_type`, not `activity_type` |
| `actor_kind` · `actor_id` | ✅ polymorphic, no FK | keep |
| `on_behalf_of_user_id` | ✅ | keep — attribution, and it cannot be skipped |
| `parent_event_id` | ✅ | keep — this is what makes Activity a *tree* |
| `target_kind` · `target_id` | ✅ 104 / 94 call sites | keep — **this is the generic mechanism, and it already won** |
| `details` · `trace_id` | ✅ | keep |
| `graph_id` | ✅ **`ForeignKey("graphs.id")`** | keep the column — it is the tenancy key, on 95 of 106 emits. **Drop the FK**: `core` may not depend on an app, and [§15.1](#131-core-knows-the-names-of-five-apps--in-its-schema) is the only place that does |
| `skill_ids` | ✅ | **drop** — 0 call sites |
| `run_step_id` | ✅ | **drop** — 1 call site |
| `project_id` · `todo_id` · `run_id` | ✅ | replaced by `event_scopes` — [§16.4](#94-settled--how-an-event-is-scoped), [AA7](../modules/operate/features/audit-and-activity.md#decisions). Not migrated yet |

**No model for Activity.** The tree is derived from `events` + `task_runs` and stores nothing —
which is what makes a window purge safe ([§14.1](#81-three-words-three-things)). It owns a
`schemas.py` (`ActivityNode` — one shape for both sources) and `managers/tree.py`, and no `models.py`.

The assembly is a **manager**, not a loose module: it holds rules worth testing — which parent pointer
wins (`parent_event_id`, then the run's opening event, then the delegating step), what an orphaned step
hangs off, and what an expired step shows once its stream has aged out. **The nesting is built from
those pointers, never from timestamps** — that is what makes it a causal tree rather than a sorted log.

### 9.2 The inbox — `activity/notifications`, band 4

Four tables. The first is the one that matters; [E5](#83-settled) is its whole design.

#### `notifications` — one row per **(recipient, thread)**, not per event

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | FK → `users.id` | band 4 → band 0, downward |
| `thread_kind` · `thread_id` | `String(32)` · `String(36)` | polymorphic, no FK — same shape as `target_kind`. `task` · `task_run` ([N2](#84-open)) |
| `graph_id` | FK → `graphs.id` | band 4 → band 2, downward — **legal here, unlike in `core`** |
| `reason` | enum | `author` · `assigned` · `on_behalf_of` · `mentioned` · `watching` · `manual`. Computed at fan-out and **stored** ([E6](#83-settled)) |
| `last_event_id` | FK → `events.id` | what bumped it last |
| `unread` · `read_at` · `archived` | bool · ts · bool | |
| `created_at` · `updated_at` | ts | |
| **unique** | `(user_id, thread_kind, thread_id)` | **this constraint is the coalescing rule.** Fan-out is an UPSERT that bumps `updated_at`, sets `unread` and moves `last_event_id` |

> 50 writes on one Task touch **one** row fifty times. Drop the unique constraint and you have built a
> spam machine, not an inbox.

#### `notification_subscriptions` — explicit watches only

| Column | Notes |
|---|---|
| `user_id` · `subject_kind` · `subject_id` | what is being watched |
| `level` | `watching` · `participating` · `mentions` · `disabled` — GitLab's four, and they are the right four |
| **unique** | `(user_id, subject_kind, subject_id)` |

**Implicit subscriptions are derived, not stored** — created the Task, assigned to it, or the
`on_behalf_of_user_id` of the run. All three are already columns elsewhere, and band 4 may read them.
Storing them would mean a backfill the day a rule changes.

#### `notification_deliveries` — [N4](#84-open), at-least-once

| Column | Notes |
|---|---|
| `notification_id` | nullable — a webhook fires without an inbox row |
| `channel` | `in_app` · `email` · `webhook` |
| `status` | `pending` · `sent` · `failed` · `dead` |
| `attempts` · `last_attempt_at` · `next_attempt_at` | exponential backoff |
| `response_code` · `response_body` | truncated. This is what makes a failure debuggable, and it is the thing GitHub and Stripe both expose |

#### `notification_channels` — the configured endpoints

| Column | Notes |
|---|---|
| `graph_id` · `kind` · `config` | JSON. Secrets encrypted at rest, same Fernet key as `llm_providers` |
| `enabled` · `created_by_id` | |

### 9.3 `automations` dissolves — there is no such package

The effects a rules engine would fire split cleanly in two, and **both halves already have a home**:

| Effect | Belongs to | Because |
|---|---|---|
| `notify` — in-app | `activity/notifications` | it is a notification. Same tables, same fan-out |
| `webhook` | `activity/notifications` | already a `channel` on `notification_deliveries` ([§16.2](#92-the-inbox--activitynotifications-band-4)) |
| `open_run` | **[10.1 Schedules](../modules/operate/features/schedules.md)** | firing work is orchestration, not activity |

**Telling someone and doing work are different problems**, and the give-away is the reliability
requirement — which [§16.3 *when it fires*](#93-automations-dissolves--there-is-no-such-package) already
found on its own. A missed email is an annoyance; a missed `open_run` is work that silently did not
happen. One can ride the at-most-once `LISTEN` transport; the other needs a durable claim. Forcing both
through one engine means building the expensive guarantee for the case that does not need it.

#### The run half is a **trigger kind on Schedules**, not a new subsystem

[10.1](../modules/operate/features/schedules.md) already specifies exactly these tables:

| 10.1 today | An event trigger would need |
|---|---|
| `schedules` — cron · agent · overlap policy · target | the same, with **`action_pattern` + scope** in place of the cron |
| `firings` — time · outcome · run id or created task id · skip reason | identical |
| Routes · overlap policy · pause | identical |

> **Cron fires work on *time*; an event trigger fires the same work on *a write*.** Same effect, same
> overlap question, same firing record — so it is one feature with two trigger kinds, not two features.

The precedent agrees: GitHub keeps Actions triggers (`on: push`) inside the workflow system and
notification settings inside the notification system. **Neither knows the other exists.**

#### Consequences

| | |
|---|---|
| **13.10 is not needed** | it had no index row and no feature file ([§14.5](#85-blocked)). Nothing is now blocked on it — the notification half lands with `notifications`, the run half as a trigger kind on 10.1 |
| The band has **two members**, not three | `activity/` — the tree, and `notifications/`. One coherent purpose: **record what happened, and tell people about it** |
| `automation_rules` is not a table | notification rules sit beside subscriptions; trigger rules sit in `schedules` |
| One package with no measured need, removed | `automations` was the only member of the band with neither a defect nor a decision behind it |

**Open, for whenever 10.1 is built:** where Schedules lives. It reads events (band 0) and opens runs
(band 3), so `runtime/schedules/` works, as does an app reaching `runtime` through
[`RunOpener`](#31-breaking-the-two-real-cycles). Not decided here — 10.1 is 🔵 and unbuilt.

### 9.4 Settled — how an event is scoped

`project_id` · `todo_id` · `run_id` are three columns doing one job, and every new app that wants
scoped events adds a fourth ([§15.1](#131-core-knows-the-names-of-five-apps--in-its-schema)).

| Option | | |
|---|---|---|
| **Keep the three columns** | no work, indexes already exist | `core` keeps growing with the product — the [§3.1.1](#211-common-is-not-core) test failing |
| **`event_scopes` join table** — `(event_id, scope_kind, scope_id)` | unbounded, properly indexed, and it is **exactly the query notification fan-out needs**: *every event on this thread* | one join on the activity read; 1–3 extra rows per event |
| **`scopes` JSONB array** | one column, no join | GIN-indexed queries are harder to read, and harder to get right |

**Settled: the join table** —
[AA7](../modules/operate/features/audit-and-activity.md#decisions) is the decision, and that file is
where it is maintained. A single `(scope_kind, scope_id)` pair cannot work: an event belongs to a graph
*and* a project *and* a task *and* a run at once. That is a path, not a value. `graph_id` stays a
column regardless — it is tenancy, present on 95 of 106 emits, and every read filters on it.

**No migration is written yet.** The three columns stand until something needs the join table, and
[E1](#83-settled) is the first thing that will. Dropping `project_id` · `todo_id` · `run_id` is a
schema-only change with an Alembic revision and a backfill; it is not part of this migration, and
nothing in the REST API moves with it.

### 9.5 What is blocked

| Table | Blocked on |
|---|---|
| `events` changes | nothing — [§16.1](#91-the-record--coreevents-band-0)'s drops are pure cleanup |
| every `notification_*` table | **13.10 has no index row and no feature file.** [CLAUDE.md rule 1](../../../CLAUDE.md) |
| ~~`automation_rules`~~ | **gone** — [§16.3](#93-automations-dissolves--there-is-no-such-package) |

And a standing rule from [engine/CLAUDE.md](../../../engine/CLAUDE.md): **every new model gets a
starlette-admin view** in `server/admin/views.py`, with `config` and any `*_encrypted` column excluded
from `fields`.

## 10. Package → module correspondence

Neither tree is derived from the other; this table is the join.

| Package | Serves | Band |
|---|---|---|
| `graph` | [Graph connectors §12](../README.md#12--graph-connectors) | 1 |
| `core/auth` | [Identity and access §11](../README.md#11--identity-and-access) — identity only; **membership is `graphs`** | 0 |
| `core/events` | [Audit and activity 10.2](../modules/operate/features/audit-and-activity.md) — the record. The **activity tree** that reads it is an app | 0 |

| `core/telemetry` · `core/logging` | [13.4](../modules/platform/features/logging.md) · [13.5](../modules/platform/features/telemetry.md) | 0 |
| `apps/llm` | [Providers and models 5.1](../modules/agents/features/providers-and-models.md) | 2 |
| `apps/graphs` · `apps/modeller` · `apps/canvases` | [Connect and model §1](../README.md#1--connect-and-model) · [Explore §4](../README.md#4--explore) | 2 |
| `apps/datasets` | [Bring data in §2](../README.md#2--bring-data-in) | 2 |
| `apps/sessions` | [Ask §3](../README.md#3--ask) | 2 |
| `apps/agents` · `apps/skills` | [Agents §5](../README.md#5--agents) · [Skills §6](../README.md#6--skills) | 2 |
| `apps/task_plans` | [Workflows §7](../README.md#7--workflows) | 2 |
| `apps/work` | [Work §9](../README.md#9--work) | 2 |
| `activity/` | [Audit and activity 10.2](../modules/operate/features/audit-and-activity.md) — the **reader**. `core/events` is the record | 4 |
| `activity/notifications` | Notifications — the inbox, its rules and its delivery. **Blocked**: no index row, no feature file | 4 |
| `runtime` | [The runtime 13.8](../modules/platform/features/runtime.md) | 3 |
| `server` · `cli` | every module's API column · [13.3](../modules/platform/features/command-line.md) | 4 |

A package serving more than one module is normal. A **module served by no package** is a gap; a
**package serving no module** is dead code.

---

# Part one and a half — what has landed

Measured 2026-09-15, after the conversion pass. **Part two below is the plan as
written; this is the state it reached.** Where the two disagree, this section is
the tree and part two is the intent.

| | Then | Now |
|---|---|---|
| `services.py` in an app | 13 | **0** |
| `store.py` in an app | 8 | **0** |
| `routes.py` under `apps/` or `runtime/` | 14 | **0** |
| Queryset files | — | **29**, one per model |
| Manager files | 0 | **22** |
| `server/<module>/` folders | 0 | **17** |
| `admin.py` beside its module | 0 | **13** (`server/admin/views.py`: 664 → 274 lines) |
| `import-linter` band allowances | 15 | **6** |
| `import-linter` cycle allowances | 15 | **6** |
| **OpenAPI diff, every commit** | — | **empty** |
| Full suite · the four graph-DB suites | — | **572 passed** · **260 passed** (61 Gremlin skips — no ArcadeDB) |

## What closed, and what it cost

| Move | Result |
|---|---|
| `apps/setup` extracted from `apps/graphs` (§14.1) | the four cycles closed — but only after `GraphManager.serialize` stopped deriving setup state and `graphs/deps.py` moved to `server/`. **A file move alone re-formed the cycle through `setup → datasets → graphs`** |
| `apps/projects` folded into `apps/work` | one package, no migration — table names unchanged |
| `activity/` created as band 4 | the tree and the Task read-model; both need `apps` *and* `runtime`, which no other band may |
| `ModelStore` 42 methods → 8 querysets | `ModelStore` survives as a 39-method façade so its call sites migrate gradually |
| `manager.py` → `pool.py` | *manager* now means business logic everywhere. `GraphConnectionManager` kept as an alias |
| Runtime managers for cross-band reads | `skill_usage`, `workflow_runs`, `agent_lifecycle` — each reads `task_runs`, which an app may not |

## What the graph-database suites caught

`tests/graph` · `tests/graphs` · `tests/explorer` · `tests/cli` flush the local
Neo4j, so they are run deliberately rather than on every commit. Run against the
conversion pass, they were **not** green, and one failure was a live defect:

| Failure | What it was |
|---|---|
| `SetupManager._iso` → `AttributeError`, 8 tests | **A real break.** The `graphs` → `graphs + setup` split moved `_iso` to `setup/sections.py` as a module function and left six `self._iso(...)` call sites. `derive_setup_state` is reached from `is_gate_open`, a dependency on **every gated route** — so `connected` · `grounded` · `answering` all returned 500 |
| `test_store.py` · `test_setup_state.py` asserting `HTTPException` | Stale tests. A queryset raises `NotFoundError` and a manager raises `ConflictError` ([§4.1](#41-the-two-guarantees)); `server/app.py` still maps both to the same 404 and 409 the API returned before |

> **The lesson is about the guard, not the bug.** 312 tests and an empty OpenAPI
> diff passed over a 500 on every gated route, because the suite that exercises
> those routes needs a database the default run does not have. **A package
> converts with its graph-DB suite run, or it converts unverified** — and a
> cross-package move like `graphs` → `graphs + setup` is exactly where a helper
> loses its `self`.

## The rules are enforced, not just written

`tests/golden/test_code_shape.py` — six checks beside the three `import-linter`
contracts and the three snapshots. Each carries a named allow-list; **deleting an
entry is how a conversion is finished.**

| # | Check |
|---|---|
| 1 | no `select()` outside a `querysets` module |
| 2 | no `fastapi` under any `managers/` or `querysets/` |
| 3 | no `session.commit()` in a view or a CLI command |
| 4 | a `routes.py` defines no function |
| 5 | `cli/` imports no `models` or `querysets` |
| 6 | `emit_event` only from a `managers/` module |

The checks **tokenise** rather than grep: a docstring that mentions `select()` is
prose, and matching raw text made every rule here unwriteable.

## What is deliberately not done

| Left | Why |
|---|---|
| `apps/datasets` managers — `importer` · `bundle` · `stitches` | its views moved for the band; converting them is its own pass |
| `runtime/services.py` · `stream.py` · `emissions.py` · `interpreter` | the runtime's own split (planner · state · stream) is [§24](#24-file-sizes-for-reference)'s work, not this one |
| `server/routes/models.py` · `model_links.py` · `schemas.py` | the three pre-existing route files; they never moved band |
| `ModelStore` · `EventStore` façades | shims, deleted when nothing imports them |
| Per-app `events.py` subclasses (E1) | `EventManager` exists and `emit_event` forwards to it; the 108 call sites convert package by package |
| Six band allowances, six cycle allowances | each named in `pyproject.toml` with the change that closes it |


---

# Part two — the migration

*Measured, and temporary. Delete this half when the last package converts.*

## 11. What the tree looked like at the start

Twenty-two packages. Measured, not estimated:

| | |
|---|---|
| Two-package import cycles | **32** — counted by AST, not grep. A grep over `from invana.` also matches comments; that is how a phantom `llm ↔ telemetry` appeared |
| …closed by moving `Base` into `core` | **13** — every one of them `modeller ↔ something`, and none of them visible to `import-linter`: they all ran through `modeller/migrations/env.py`, and `migrations/` has no `__init__.py`, so it was never in the import graph. [1.2](refactor-plan.md#phase-1--core) |
| …remaining, each allowed by name | **19**. Deleting an allowance is how a step is finished |
| Largest fan-out | `server` 16 · `modeller` 14 · `task_run` 14 |
| Largest packages | `modeller` 1.0 MB · `graph` 776 KB · `task_run` 600 KB |

### 11.1 The cycles, by cause

| Cluster | Count | Cause |
|---|---|---|
| `modeller ↔ 13 others` | 13 | **`Base` — the SQLAlchemy declarative base — lived in `modeller/models.py`.** Fourteen packages imported it; `modeller` imported them back for its migrations. **Closed at [1.2](refactor-plan.md#phase-1--core)** |
| `run ↔ work · workflows · agents · sessions · skills` | 5 | genuine two-way domain coupling: the runtime needs the envelope and the plan; they need to open a run |
| `server ↔ graphs · run` | 2 | the edge layer is imported *by* domain packages |
| `projects ↔ work`, `llm ↔ llm_providers`, `auth ↔ events`, `graphs ↔ …` | 12 | packages that were split along the wrong seam, or never finished splitting |

**One conflation causes forty per cent of them.** `modeller` does two unrelated jobs: it holds the ORM
base and the migrations, *and* it holds graph-modelling domain logic. Everything must import the
first, so everything is entangled with the second.

### 11.2 Names that will confuse every contributor

| Pair | Problem |
|---|---|
| `graph` / `graphs` | one is the driver layer (Cypher and Gremlin); the other is the Graph domain entity. **Resolved by the move** — it becomes `core.graph` and `graphs` |
| `llm` / `llm_providers` | one calls a model; the other stores the configured endpoints. And `llm` itself is two things — see §9 |
| `projects` / `work` | both hold work-organisation code, and they import each other |

Each needs either a merge or a rename that says which is which.

## 12. How far the code is from the standard, measured

### 12.1 Querysets — 54% built, under the name `store`

`store.py` is already this layer: a stateless class, session per method, returns models, no rules.
**It is a rename and a completion, not an invention.**

| | Count |
|---|---|
| ORM models in the engine | **39** across 14 packages |
| …queried through a store today | **17** |
| …in an app that has a store, but queried around it anyway | **5** — `Graph` · `GraphMember` · `ModelLink` · and two never queried |
| …with **no** store at all | **17** — `Task` · `TaskDependency` · `Project` · `ProjectAssignment` · `Dataset` · `ImportJob` · `Workflow` · `User` · `RefreshToken` · `PersonalAccessToken` · `Run` · `RunStep` · `TodoStream` · `Emission` · `ProjectionTemplate` · `PromptAnswer` · `Todo` |
| `select(<Model>)` sites **outside** a store | **≈116** |

The five worst, and they are the whole argument:

| Model | Store | Query sites outside it |
|---|---|---|
| `Run` | none | **13** — `runtime/services.py` ×6 · `stream.py` ×2 · `delegation.py` ×2 · `work/activity.py` ×2 · `routes.py` ×2 |
| `Task` | none | **12** — `work/services.py` ×7 · `work/routes.py` ×3 · others |
| `RunStep` | none | **12** — spread over 7 files |
| `User` | none | **9** — including `cli/commands/` ×3 and `server/admin/auth.py` |
| `Agent` | `AgentStore` | **6 leaked** despite the store existing |

### 12.2 `ModelStore` is a god-store, and the per-model split is its fix

| | |
|---|---|
| One class | `ModelStore` |
| Serving | **11 models** |
| Methods | **45** |
| Size | **31 KB** — third-largest file in the engine |

`apps/modeller/querysets/` with one file per model turns a 45-method class into eleven 4-method
ones. This is the single clearest case for the folder form in §1.2.

By contrast `apps/canvases/store.py` is **already right** — `CanvasStore` and `CanvasStateStore`, one
per model, in one file. It becomes `querysets/canvas.py` + `querysets/canvas_state.py` and nothing
else changes.

### 12.3 Managers — 0% built

| | Count |
|---|---|
| `services.py` files | **13** |
| …that define a class | **0** |
| Free functions in them | **179** |
| One-off files that take a session and hold rules | **17** more — `work/activity.py` · `modeller/links.py` · `versioner.py` · `staging.py` · `portability.py` · `reconciler.py` · `projector.py` · `introspector.py` · `json_io.py` · `datasets/importer.py` · `stitches.py` · `bulk.py` · `run.py` · `graphs/query_service.py` · `sessions/reconcile.py` · `events/actions.py` · `events/notify.py` |

Nothing is class-shaped today, so `managers/` is genuinely new work — unlike querysets, there is no
54% to build on.

### 12.4 Views — every handler is one, and none is separated

Measured by AST over every function carrying a `@router.*` decorator:

| | Count |
|---|---|
| `routes.py` files | **20** across `apps/` (12) · `runtime/` (2) · `server/` (6) |
| …that import another package's `models.py` directly | **13 of 13** under `apps/` and `runtime/` |
| `session.commit()` **inside a handler** | **86** |
| `select()` inside a handler | **10** |
| Longest handler | 59 lines — `upgrade_model_route`, `server/routes/models.py` |

The worst five, which are where §1's view rule pays:

| File | Handlers | Longest | In-handler DB calls |
|---|---|---|---|
| `server/routes/models.py` | 32 | 59 | 24 commits |
| `apps/work/routes.py` | 13 | 24 | 10 commits · 1 delete |
| `apps/graphs/routes.py` | 15 | 36 | 9 commits |
| `runtime/template_routes.py` | 5 | 39 | 4 commits · 1 select · 1 add · 1 flush · 1 delete |
| `apps/datasets/routes.py` | 9 | 52 | 5 selects · 1 commit |

This also **corrects [§11](#23-two-corrections-to-earlier-readings)'s reading of `server/routes/models.py`.**
The earlier note — *"32 routes, no rule, splitting it would be cosmetic"* — held only under the old
vocabulary. Under §1 it is 32 views that commit their own transactions, and it splits into
`server/models/{routes,views}.py` because **every** route file does, not because this one is large.

### 12.5 The file-name vocabulary has drifted

| | Count |
|---|---|
| Distinct `.py` basenames under `apps/` · `core/` · `runtime/` | **83** |
| …that name a role (`models` · `schemas` · `services` · `routes` · `store`) | **5**, covering 63 files |
| …that appear exactly once | **78** |

Under §1 that becomes six role names plus the 13 pure modules of §5 — the other ~65 one-off names
resolve into a queryset, a manager, or a view.

## 13. What `apps/` writes, and what it does to `core`

Measured 2026-09-15. [§14](#8-events-activity-and-notifications) settled the words; this is what the
code actually does with them, and it changes where activity goes.

### 13.1 `core` knows the names of five apps — in its schema

`core/events.Event` carries six columns naming band-2 and band-3 concepts:

| Column | Names | Call sites passing it | Indexed |
|---|---|---|---|
| `graph_id` | `apps/graphs` — **and a real `ForeignKey("graphs.id")`** | 95 | ✅ |
| `todo_id` | `apps/work` | 21 | ✅ |
| `project_id` | `apps/projects` | 20 | — |
| `run_id` | `runtime` | 10 | ✅ |
| `run_step_id` | `runtime` | **1** | — |
| `skill_ids` | `apps/skills` | **0** | — |

Meanwhile the **generic** pair is already the dominant mechanism:

| | Call sites |
|---|---|
| `target_kind` | **104**, over 19 `TARGET_*` constants |
| `target_id` | **94** |

> **The escape hatch is used four times more than the hardcoded columns, and the hardcoded ones are a
> partial, inconsistent duplicate of it.** Every new app that wants its events scoped needs a column
> on a `core` table, a migration and an index — which is [§3.1.1](#211-common-is-not-core)'s
> test failing: `core` grows with the product.

**The band rule is enforced on imports, not on foreign keys.** `Event.graph_id → graphs.id` is `core`
depending on an app at the schema level, and `import-linter` cannot see it. Worth knowing before
someone concludes contract 1 is green.

### 13.2 Dead weight, found while counting

| Remove | Measured |
|---|---|
| `Event.skill_ids` | **0** call sites pass it |
| `Event.run_step_id` | **1** |
| 11 action constants | declared, never referenced: `GRAPH_ARCHIVE` · `GRAPH_UNARCHIVE` · `CONNECTION_PING` · `CONNECTION_INTROSPECT` · `CONNECTION_VERSION_DETECTED` · `SKILL_APPLY` · `THINKING_RESUME` · `TASK_ANSWER` · `TASK_BLOCK` · `TASK_DELETE` · `SYSTEM_CONNECTION_HEALTH_CHECK` |
| `actions.py` itself | 122 verbs **+ 19 target kinds** for 21 subjects, in one `core` file — split per app by E1 |

`SKILL_APPLY` being dead is worth a second look: [10.2](../modules/operate/features/audit-and-activity.md)
describes it as shipped behaviour. Either the feature file is ahead of the code, or the emit was lost.

### 13.3 Emission, by package

| Package | Emits | Distinct actions | Under [§1](#4-inside-a-package) |
|---|---|---|---|
| `apps/graphs` | 19 | 15 | → its managers |
| `server/routes` | **14** | 13 | **a view holding a rule** — moves into managers |
| `runtime` | 14 | 12 | → its managers |
| `apps/work` | 13 | 11 | → its managers |
| `core/auth` | 13 | 10 | → `core/auth/managers` |
| `apps/agents` · `llm_providers` · `projects` · `canvases` · `sessions` · `skills` · `datasets` · `explorer` · `task_plans` | 1–6 each | — | → their managers |
| `cli/commands` | 4 | 3 | → managers, called by the CLI |

### 13.4 Activity is above `runtime`, not beside it — and that is measured

The question *"does activity deserve a root module"* has an answer the import graph already gives.

`apps/work/activity.py` imports `runtime.models`. **`apps/` is band 2 and `runtime` is band 3, so that
is an upward import — illegal by [code-shape §4](#3-the-rule).** It is not alone:

| **13 upward imports, `apps/` → `runtime`, across 6 apps** | |
|---|---|
| `apps/sessions` | 4 — `routes.py` ×3, `schemas.py` |
| `apps/work` | 3 — `services.py`, `routes.py`, `activity.py` |
| `apps/task_plans` | 2 — `services.py`, `routes.py` |
| `apps/agents` | 2 — `services.py` |
| `apps/skills` · `apps/datasets` | 1 each |

These are not new: they are the `run ↔ work · workflows · agents · sessions · skills` cluster from
[code-shape §2.1](#111-the-cycles-by-cause), seen from the band angle instead of the cycle angle.

**So `apps/activity` was the wrong answer, and [§9.1.1](#1411-the-same-shape-again--the-activity-tree) is
superseded.** A reader that needs `apps` *and* `runtime` cannot live in either. It belongs above both.

Three things share that exact position — they read every domain band, and nothing but the edge reads
them:

| | Reads | Read by |
|---|---|---|
| the activity tree | `core/events` · `apps/*` · `runtime` | `server` |
| notification fan-out | the same | `server` |
| automation rules | the same | `server` |

That is a band, by the only test that defines one: **a distinct import position.**

### 13.5 What §1 pays toward it

Six of the thirteen upward imports are in a `routes.py`, and [§1](#4-inside-a-package)
moves every route file to `server/` — band 4, which may import anything.

| App | Upward imports | Closed by |
|---|---|---|
| `work` | 3 | `routes.py` → `server` · `activity.py` → the new band · `services.py` → `RunOpener` ([code-shape §4.1](#31-breaking-the-two-real-cycles)). **All three** |
| `sessions` | 4 | 3 by `routes.py` → `server`; `schemas.py` composes a runtime schema and needs a decision |
| `skills` · `task_plans` | 1 each in `routes.py` | `routes.py` → `server` |
| `agents` | 2 | the retirement preview — a cross-app read, so the new band ([§9.2](#142-ranked) item 5) |
| `datasets` | 1 | `run.py` genuinely writes runtime rows. Stays, or becomes a contract |

**Eight of thirteen close as a side effect of work already scheduled.** The band refactor and the
file-shape refactor are paying into the same account.

### 13.6 What the band is called

**Settled: `activity/`.** The band holds the tree and `notifications/`. (`automations/` was a third
member until [§16.3](#93-automations-dissolves--there-is-no-such-package) dissolved it.)

| Considered | |
|---|---|
| `readers/` | **rejected.** Accurate for the tree only — `notifications` writes rows and sends mail |
| `downstream/` · `subscribers/` | honest about the position, but new vocabulary for a band whose anchor member already has a name |
| Three top-level packages, no folder | matches `graph/` and `runtime/`, each a band in one entry — but the band stops being visible in the import path, which is what [code-shape §3](#2-the-bands) says `apps/` is for |

The objection to `activity/` was that it over-claims, since a notification is not a tree. It is
outweighed: **a package name here is the anchor concept, not an exhaustive description** — `apps/graphs`
holds the Graph *and* membership *and* connections, and `runtime/` holds the planner *and* the
catalogue. Framed correctly the band reads true: *what happened, who is told about it, and what fires
because of it.*

> **The guard that keeps [§14.1](#81-three-words-three-things) intact:** in product copy, in
> [terminology.md](../terminology.md) and in every API response, **Activity means the tree of events and
> nothing else.** The band is a folder name; it does not widen the word.

### 13.7 The shape

```
invana/
├── core/          0   settings · db · models · migrations · logging · telemetry · auth
│   └── events/        the row — table, write path, redaction, retention, the tail daemon
│       └── registry.py    the subject registry · populated by server/, never by core (E2)
├── graph/         1   the graph engine
├── apps/          2   one product idea each · models · querysets · managers · schemas
│   └── <app>/events.py    that app's verbs and target kinds, and how to describe one (E1)
├── runtime/       3   planner · interpreter · catalogue · executor · state · stream
├── activity/      4   reads every domain band · read only by the edge
│   ├── managers/tree.py  the tree — per task, per agent, per Graph (10.2 C6). No models: it is derived
│   └── notifications/    the inbox: thread, reason, read state (E5/E6) · rules · channels · deliveries (N4)
└── server/ cli/   5   views · routes · deps · the CLI
```

Notifications land **in the new band, not in `core`** — which overrides
[code-shape §3.1](#21-inside-core)'s `core/alerting`. Delivery alone could be core, but
fan-out has to resolve who and why across `apps` and `runtime`, so it sits beside the tree.
The channels — SMTP, webhook, the in-app row — stay core-shaped and can move down later if a second
caller appears.

## 14. Where the cycles stand

**18 remain, down from 32.** They are grouped by what closes each in
[code-shape §9](#15-what-is-left-and-why). This file adds *where the code should go*,
which §9 does not say.

### 14.1 The headline — four cycles close with an app, not a protocol

`apps/graphs/services.py` reaches into other apps from exactly **two** functions:

| Function | Reaches | Is |
|---|---|---|
| `derive_setup_state` | `Dataset` · `GraphModel` · `GraphVersion` · `ImportJob` · `LLMProvider` · `NodeTypeDefinition` · `Skill` | a **cross-app read** — the six derived steps of [13.7 Setup](../modules/platform/features/setup.md) |
| `create_graph` | `seed_agents` | a **cross-app write** — a different problem, see §12 |

The four cycles exist only because that read lives in `graphs`, and those apps import `graphs` back
for the `Graph` model.

**Move `derive_setup_state` into `apps/setup/`.**

| Why it works | |
|---|---|
| An app may import other apps | band 2 → band 2 is legal, provided it stays acyclic |
| Nothing would import `setup` | so no new cycle forms. The four close |
| It is not edge work | the setup steps are *derived from facts* — product logic, and the edge holds no rule worth testing without a request |
| The docs already agree | Setup is its own feature with its own file. One app per product idea |

No protocol, no registry, no abstraction. One file move. Under §1 it lands as
`apps/setup/managers/setup.py` — a manager that reads six other apps' managers, which is exactly what
§3 permits.

### 14.1.1 The same shape again — the activity tree

`apps/work/activity.py` builds the activity tree, and imports four packages to do it: `apps.agents` ·
`apps.skills` · `runtime` · `core.auth`. It is a cross-app **read** living inside a domain app —
identical in shape to `derive_setup_state`, and it gets the identical answer.

> **Superseded by [§15.4](#134-activity-is-above-runtime-not-beside-it--and-that-is-measured).** The
> conclusion — activity is its own package — holds. The *band* does not: `activity.py` imports
> `runtime.models`, and `apps/` (band 2) may not import `runtime` (band 3). It goes **above** runtime,
> not into `apps/`. The reasoning below is otherwise unchanged.

**Move it out of `apps/work/`.**

| | Measured |
|---|---|
| Call sites to move | **one** — `apps/work/routes.py:279` |
| Cycles closed | **none.** `work/services.py` and `work/routes.py` import `apps.agents` and `runtime` on their own, so `work ↔ agents` and `work ↔ runtime` survive the move. *This corrects an earlier reading that expected the move to close them* |
| Why it still goes | [10.2 C6](../modules/operate/features/audit-and-activity.md) needs **three** trees — per task, per agent, per Graph. `work` can justify exactly one of them, and an agent tree inside `work` is the tell |
| What else lands there | the notification fan-out reader ([§14](#8-events-activity-and-notifications)), which reads the same rows |
| Why not `core/` | it imports `apps` and `runtime` — two of the five targets contract 1 forbids. Shared, but high. [code-shape §3.1.1](#211-common-is-not-core) |

Under [§1](#4-inside-a-package) it lands as `apps/activity/managers/` — a manager that
reads other apps' managers, which is exactly what [§3](#5-what-a-manager-looks-like) permits. It has
no models of its own, so it has no querysets — the [§5](#7-the-exceptions-each-named) case that
`apps/llm` and `apps/explorer` already set.

### 14.2 Ranked

| # | Change | Closes | Cost |
|---|---|---|---|
| 1 | `ActionResponse` down out of `server/schemas` | **2** | trivial — already specced at [code-shape §7 step 5](#171-now--each-closes-something-measured) |
| 2 | `apps/setup/` for `derive_setup_state` (§9.1) | **4** | one file move |
| 3 | Merge `llm_providers` → `llm`, `projects` → `work` | **2** | mechanical; also settles two confusing names. Fold into §8 step 3 |
| 4 | `core/contracts.py` — `RunOpener` + `EnvelopeCheck` | **5** | needs design. The one genuine architectural gap left |
| 5 | The agent-retirement preview, which reads `sessions` and `work` | **2** | same shape as §9.1 — a cross-app read living in the wrong app |
| 6 | Carve the activity tree out of `work` (§9.1.1, banded by §15.4) | **0** directly — but it is 1 of the 13 upward imports §15.5 closes | one file, one call site |

**18 → 3, with no behaviour change anywhere.** Start with 1 and 2: six cycles for two small moves,
and neither introduces a concept.

### 14.3 What survives all five

| Cycle | Needs |
|---|---|
| `core.auth ↔ core.events` | nothing — inside `core`, allowed by the band rule. A cycle, but not one worth a protocol |
| `core.events ↔ apps.agents` | capturing the principal's name at write, per [10.2](../modules/operate/features/audit-and-activity.md) — a behaviour change and a backfill |
| `core.auth ↔ apps.graphs` | `UserOut.graphs` embeds the caller's memberships in every auth response, so the composition has to move above `auth` |

## 15. What is left, and why

The pass closed **14 of the 32** two-package cycles. Measured the same way as
[§2](#11-what-the-tree-looked-like-at-the-start) — by AST, on the banded tree:

| | |
|---|---|
| Two-package cycles | **18**, down from 32 |
| Closed by moving `Base` and the migrations into `core` | 13 |
| Closed by moving `events/routes.py` into `server` | 1 |
| Allowances in `pyproject.toml` | 29 distinct imports. Every one matches something real — `import-linter` fails on an allowance with no match, so a stale one cannot survive a commit |

### The 18, by what closes them

| Cluster | Count | Closes with |
|---|---|---|
| `runtime ↔ sessions · work · workflows · skills · agents` | 5 | `RunOpener` and `EnvelopeCheck` in `core/contracts.py` — [§7 step 7](#171-now--each-closes-something-measured). The genuine two-way need: the runtime wants the envelope and the plan, they want to open a run |
| `graphs ↔ agents · datasets · llm_providers · skills` | 4 | `graphs/services.py` reaches up into four apps to assemble the setup state. A read that belongs behind one service call, not four model imports |
| `server ↔ graphs · runtime` | 2 | moving `ActionResponse` down out of `server/schemas` — [§7 step 5](#171-now--each-closes-something-measured) |
| `agents ↔ sessions · work` | 2 | retiring an agent reads its sessions and tasks. Same shape as the `graphs` cluster |
| `llm ↔ llm_providers`, `projects ↔ work` | 2 | the two merges at [§7 step 6](#171-now--each-closes-something-measured), which also settle which half keeps which name |
| `core.auth ↔ apps.graphs` | 1 | `MembershipReader`. `UserOut.graphs` embeds the caller's memberships in every auth response, so the composition has to move above `auth` |
| `core.events ↔ apps.agents` | 1 | capturing the principal's name at write, per [10.2](../modules/operate/features/audit-and-activity.md) — a behaviour change and a backfill |
| `core.auth ↔ core.events` | 1 | **inside `core`, and allowed by the band rule** — `core` may import `core`. Still a cycle: `auth` emits events, `events` resolves a `User`. Worth knowing; not worth a protocol |

**Nothing above is an accident of placement any more.** Each one is either a
real two-way domain need, or a seam that needs a behaviour change to cut — and
every one of them is named in the contract with the change that removes it.
Deleting an allowance is how each of those changes gets marked done.

## 16. Order — one package at a time, smallest first

Each step is one package, and each is independently shippable. Nothing here changes a route, a field
or a behaviour.

| # | Package | Why this order | Size |
|---|---|---|---|
| 0 | — | Settle §7.1. Write the four roles into [code-shape §5](#4-inside-a-package) | doc only |
| 1 | `apps/skills` | 1 model, 5 service functions, a store that is already right. **The reference conversion** | tiny |
| 2 | `apps/canvases` | 2 models, 2 stores already one-per-model. Proves the folder form | small |
| 3 | `apps/work` + `apps/projects` | 4 models, **no store, 23 leaked sites**. Highest defect density. Fold the merge in ([§9 step 3](#142-ranked)) | large |
| 4 | `runtime` | 8 models, **no store, ≈36 leaked sites**. Biggest single win | large |
| 5 | `apps/modeller` | split `ModelStore` 45 → eleven | large |
| 6 | `core/auth` · `core/events` | per §7.3 | medium |
| 7 | the rest | `agents` · `sessions` · `graphs` · `datasets` · `llm` · `llm_providers` · `task_plans` · `explorer` | — |
| 7b | the activity tree | carve out of `work` while converting it at step 3 (§9.1.1) — into `activity/`, band 4 | one file |
| 7c | **`cli/commands`** | 4 files hold raw `select()` — `stitches.py` · `loader.py` · `datasets.py` · `models.py` — and emit events directly. Band 5, so it gets the view rule: parse, call one manager, print ([code-shape §5.1](#41-the-two-guarantees)) | medium — `stitches.py` reaches 10 packages |
| 7d | `server/admin` | **not an exemption.** `views.py` holds no query — 39 `ModelView` declarations and 9 permission methods. Three fixes: `auth.py:54`'s `select(User)` → `core/auth/querysets/user.py`; the 39 declarations → `server/<module>/admin.py`, beside the code they describe; `server/admin/` keeps only the mount, the sections, the auth provider and the templates | small, and it resolves `views.py` meaning two things |
| 8 | `server/<module>/` | move all 20 route files; `views.py` and `routes.py` split | mechanical, one commit per module |
| 9 | Enforce | see below | — |

### 16.1 Enforcement, the same way the bands are enforced

A shape document nobody checks decays exactly as fast as a layering one. Four checks, beside
`import-linter` in pre-commit and CI:

| # | Check | Says |
|---|---|---|
| 1 | no `select(` · `update(` · `delete(` outside a `querysets` module | grep, excluding only the three exemptions in [code-shape §5.1](#41-the-two-guarantees): `graph/connectors/*/querysets/` · `core/migrations/versions/` · a queryset's own body. **`server/admin/` is not exempt** — measured, `views.py` holds no query today |
| 2 | no `fastapi` import under any `managers/` or `querysets/` | grep. A manager that raises `HTTPException` is a view in the wrong file |
| 3 | no `session.commit(` under `server/*/views.py` **or `cli/commands/`** | grep |
| 4 | `routes.py` defines no function | AST |
| 5 | **`cli/commands/` imports no `models.py` and no `querysets`** | grep. `cli/` and `server/` are peers — two front-ends over the same managers, and **calling a manager *is* calling the Python API** |
| 6 | no `emit_event` outside a `managers/` module | grep. [E3](#83-settled) — emission belongs to the manager that does the write |

**Check 1 is the one that proves guarantee 1**, and it is a plain grep, so it can be added the day the
first package converts and tightened by deleting allowances as the rest follow.

Add each check **as its step lands**, allowing today's violations by name, exactly as
[code-shape §4.2](#32-enforcement) does for cycles. Deleting an allowance is how a
package is finished.

## 17. Order of the band work

Split into what a measured defect justifies, and what waits for one. **Every step in the first table
names the problem it removes.** Nothing in the second is wrong — it is unscheduled.

### 17.1 Now — each closes something measured

| # | Step | Removes | Risk |
|---|---|---|---|
| 1 | Create `core/`. Move `settings` · `db` · `utils` · `logging` · `telemetry` in, and extract `Base` + `migrations` out of `modeller` into `core/models.py` | **~13 cycles** | none. Mechanical import rewrite |
| 2 | Add `import-linter` with the three contracts, allowing today's remaining violations **explicitly and by name** | freezes the debt | none |
| 3 | Move the membership check out of `auth/services.py` into `graphs`; move `auth` into `core` | 2 cycles | low — one function |
| 4 | Capture the principal's name at write in `events/store.py`; move `events/routes.py` to `server/`; move `events` into `core` | 3 cycles | low — and it closes a gap against [10.2](../modules/operate/features/audit-and-activity.md) |
| 5 | Invert `server ↔ graphs` and `server ↔ run` — move the shared dependency helpers down | 2 cycles | low |
| 6 | Fold `llm_providers` into `llm`, `projects` into `work` | 2 cycles · 2 confusing names | low, mechanical |
| 7 | `core/contracts.py` with `RunOpener` and `EnvelopeCheck`; wire in `server/deps.py` | **5 cycles** — the genuine ones | medium |
| 8 | Rename `task_run` → `runtime`; `task_key` → `step_key`, `TaskContext` → `StepContext` | the naming debt behind [13.8](../modules/platform/features/runtime.md) | none — large diff, trivial review |
| 9 | Split `runtime.py` (47 KB) and `tasks.py` (48 KB) into the parts in [13.8 §2](../modules/platform/features/runtime.md) | two god-files | low |
| 10 | Delete the step-2 allowances, one per cycle closed | the debt is gone | the contract becomes real |
| 11 | **Create `apps/` and move the eleven domain packages in** | nothing measured — ergonomics | none. A path rewrite in one commit |
| 12 | Convert each package to the four roles of §5 — `querysets/` then `managers/` | 116 stray `select()`s · 179 loose functions · a 45-method `ModelStore` | low, one package at a time. [§8](#16-order--one-package-at-a-time-smallest-first) |
| 13 | Move every `routes.py` to `server/<module>/{routes,views}.py` | 86 in-handler commits · **8 of the 13 band violations** | mechanical, one module per commit |
| 14 | Split `core/events/actions.py` per app; add `core/events/registry.py` | `core` knowing 21 subjects | low. [§14.3](#83-settled) |
| 15 | Create `activity/`; move the tree in | the remaining upward imports | low — one file, one call site |
| 16 | `activity/notifications` | **blocked on its feature file** | new work, not a refactor |

The constrained, commit-by-commit version of this table — with the guards that prove nothing broke —
is [refactor-plan.md](refactor-plan.md).

Step 2 before everything is deliberate: freezing the debt is worth more than closing any single
cycle, because it stops the next one being added while the others are fixed.

Step 11 is last on purpose. A mass path rewrite mixed into a semantic fix is a diff nobody can
review — and it is the one step with no defect behind it, so it should never block one that has.

### 17.2 Deferred — real designs, no measured need yet

Each waits on a trigger, not on a calendar. The design is written down; the code is not.

| Deferred | Designed in | Unblocked when |
|---|---|---|
| The **frontier / DAG plan** — `depends_on` · `when` · `map_over` · lanes · `loop` | [13.8 §4–6](../modules/platform/features/runtime.md) | **fired** — [2.3 Load a bundle](../modules/bring-data-in/features/load-a-bundle.md) needs a branch, a fan-out and a composition; a draft-judge-refine flow needs an iteration that waits on a person ([13.8 §4.1](../modules/platform/features/runtime.md)) |
| **Pools** and the other ceilings | [13.8 §8](../modules/platform/features/runtime.md) | something actually starves. One Graph-wide ceiling ships today and has not been hit |
| `uses` composition · automations · run idempotency · the provider cache | [13.8 §4 · §13 · §14](../modules/platform/features/runtime.md) | a second flow wants to reuse a first, or a pipeline needs chaining |
| `activity/notifications` | Notifications | someone needs to be told something. Until then `events` is readable |

| Kept from the deferred set, because they are not speculative | Why |
|---|---|
| **The signals enum** | it simplifies branching that already exists in `_loop`. Not new behaviour — the same behaviour, stated once |
| **Artifacts and run logs** | a real gap. `task_runs.input/output` already promises *"digests, never raw payloads"* and there is nowhere for the payload to go |
| **Approvals** | a real capability with a user story and a surface in Review |

## 18. Open — decide before the first package is converted

### 18.1 Who commits — settled

**The `get_session` dependency commits on clean return and rolls back on exception.** Views, CLI
commands and managers contain no `session.commit()` at all.

86 `session.commit()` calls sit inside route handlers today. The alternatives and why they lost:

| Option | Why not |
|---|---|
| The manager commits | a manager calling a manager either nests or double-commits, so it needs a stated rule for the composite case — and composite managers are exactly what [§6](#6-where-the-api-lives) expects |
| The view commits, one line last | works, but leaves 86 lines of transaction handling at the edge and an easy place for a 87th rule to grow |

| What this buys | |
|---|---|
| The view rule needs no exception | *no logic in `views.py`* stays literally true |
| All 86 calls are **removed**, not relocated | a manager is then testable with a plain session and no commit ceremony |
| A manager composes freely | it never owns the transaction, so calling another manager is just a call |
| Reversible | one dependency, changed before any manager is written |

### 18.1.1 Settled while converting `apps/skills` — the reference conversion

The first package answered four questions the rest inherit.

| # | Decision | Why |
|---|---|---|
| S1 | **A cross-band read lives in the higher band.** `skill_usage` reads `task_runs`, so its manager is `runtime/managers/skill_usage.py`, not `apps/skills` — an app (band 2) may not import the runtime (band 3), but the runtime importing `apps/skills` and `apps/agents` is downward and legal | it closed one of the 13 upward imports rather than relocating it. **Every cross-band read follows this**: push the manager up to the band that can legally see both sides |
| S2 | **Managers raise `core.errors`; the edge maps them.** `NotFoundError` → 404, `ConflictError` → 409, `PermissionDeniedError` → 403, `ValidationError` → 422, registered once in `server/app.py` | it is how guarantee 2 is actually achieved — a manager cannot import `fastapi`, so it cannot raise `HTTPException`. Handlers do not appear in the OpenAPI schema, so the mapping is invisible to the contract |
| S3 | **No `server/<module>/deps.py` unless the module has a dependency of its own.** Skills reuses `require_graph_member`, `resolve_graph_by_username_slug`, `get_current_user` and `get_session` under their existing names | inventing aliases for shared dependencies is indirection for symmetry |
| S4 | **`PermissionDeniedError`, not `PermissionError`** | the short name shadows a builtin, in a module every manager imports |

**A scoping refusal reads as absent, never as forbidden.** `SkillManager.get` raises `NotFoundError`
for a Skill in another Graph — the caller must not learn that the id exists. That is the shape for
every `get` in every app.

### 18.1.2 Who owns the transaction, in practice

**The edge case to watch:** a request that genuinely needs two independent transactions — a partial
write that must survive a later failure. There is none today. The day one appears it takes an explicit
unit-of-work in the manager, and it is the exception that gets written down here, not the default.

### 18.2 Where the schemas live

| Option | |
|---|---|
| `apps/<app>/schemas.py`, server reuses them | fewest files. But the app's Python API then carries wire shapes it does not need |
| Split — domain shapes in the app, request/response in `server/<module>/schemas.py` | honest, and doubles the schema count |

**Open.** Worth deciding on the first package converted and then applying, not deciding in the abstract.

### 18.3 Does `core` get managers

`core` has no routes ([code-shape §4.0](#30-what-blocks-the-move-into-core-measured)), but
`core/auth/services.py` is 27 KB of rules and `core/events/` holds `actions.py` + `notify.py`. Yes —
`core/auth/managers/` and `core/events/managers/`, called from `server/auth/views.py`. The *no routes*
rule is unaffected.

## 19. One thing to decide before `core/contracts.py`

`create_graph → seed_agents` is a **write** across apps. `RunOpener`-shaped protocols do not help: the
caller is not asking a question, it is causing an effect elsewhere.

| Option | |
|---|---|
| An event | `graph.created` lands in `core.events`; `agents` seeds itself from it. Consistent with what notification rules read anyway |
| Edge orchestration | `server` creates the graph, then seeds the agents. Legal by the band rule — the edge may import every app — and it needs no new machinery |

**§1 sharpens this.** Under the view rule, edge orchestration means a view calling two managers, which
is a rule in `views.py` — forbidden. So the choice narrows to *an event*, or *a `setup`-style manager
that owns both writes*. Worth settling with §9.2 step 4, because both questions are the same one:
**who may reach whom, and by what means.**

## 20. Open questions

| Question | Why it is open |
|---|---|
| Does `modeller` survive step 1 as one package? | Once `Base` leaves, what remains is introspection, portability, links and inheritance — plausibly two packages, not one |
| ~~Does `automations` earn its own package?~~ | **No — it dissolved.** Notify and webhook are notifications; opening a run is a trigger kind on [10.1 Schedules](../modules/operate/features/schedules.md). [§16.3](#93-automations-dissolves--there-is-no-such-package) |
| Is `apps/` worth the churn at all? | It fixes nothing measured. It is scheduled last so the question stays open until everything before it has landed |
| Should `llm` be an engine band too? | **Half of it.** `client.py` and `providers/` speak HTTP to a provider — the same kind of thing as `graph`. `intent · planner · translate · propose · grounding` build prompts from the global model and the offered skills: product logic, and the reason `llm` imports `modeller` and `skills` today. The blocker for the client half is `graphs.encryption.decrypt_credentials`, which is crypto and belongs in `core`. **Trigger: when `client.py` needs nothing from `apps/`, the split is free.** Until then it is symmetry-chasing |
| Does `sessions` belong in domain or beside the runtime? | It imports `task_run` today, and `task_run` imports it back. One of the five genuine cycles |
| Is `contracts` one package or a module inside `events`? | One package is cleaner to lint; a module inside `events` is fewer moving parts |
| Does `interpreter/loop.py` stay one class? | It is 43 KB, over the ~40 KB guideline, and splitting a class needs mixins. [runtime.md §21 step 4](../modules/platform/features/runtime.md#21-how-this-lands) — the signals enum — is what shrinks it, and that is a behaviour change |

## 21. Guardrails

| Guardrail | Why |
|---|---|
| A new package declares its band in this file before it is created | A package with no band has no rule, and the linter cannot check it |
| **`core` has no `routes.py`** | A route needs a request, a current user and a Graph — three things core is defined by not knowing |
| **A module path in data, on the wire, or in another package's import never moves** | It is a public identifier. `invana.graph` is all three — stored in `connector_class`, served by the API, and imported by five connector packages |
| **Nothing in `core` imports outside `core`** | The one rule a contributor has to remember, and the one the linter checks hardest |
| No package imports `server` | The edge is a leaf. An import of it is always a misplaced dependency |
| No table is declared outside its owning package | `core` holds `Base` and nothing else |
| A protocol is added to break a measured cycle, never to anticipate one | Otherwise `contracts.py` becomes the framework this codebase is deliberately not |
| **Every structural change names the measured problem it removes** | If the answer is *"a flow we might build"*, it belongs in §7.2, not in a commit. This is the rule that kept LangChain out, and it applies to our own code too |
| Every rule is reachable without HTTP | If a test needs a client to exercise a rule, the rule is in the wrong file |

## 22. Leave alone, with the trigger for each

| Leave | Until |
|---|---|
| `interpreter/loop.py` at 42 KB | the signals enum lands. Over the ~40 KB guideline, but splitting a class needs mixins, and the enum is what shrinks it — a behaviour change ([runtime.md §21](../modules/platform/features/runtime.md#21-how-this-lands)) |
| Splitting `apps/llm` into engine + prompt-building | `client.py` needs nothing from `apps/`. Its blocker is `graphs.encryption.decrypt_credentials`, which is crypto and belongs in `core`. Until then it is symmetry-chasing |
| `graph/connectors/*/querysets/` | never. [§5](#7-the-exceptions-each-named) — it is the precedent, and a published API |
| The 13 pure modules of [§5](#7-the-exceptions-each-named) | they take no session. That is the whole test |
| Everything in [code-shape §7.2](#172-deferred--real-designs-no-measured-need-yet) | a real flow needs it — frontier, lanes, `loop`, pools |

## 23. Two corrections to earlier readings

| Claim | Reality |
|---|---|
| *"`server/routes/models.py` is 45 KB — the largest file in the engine, so it is probably hiding business logic."* | **Partly wrong, and now superseded.** It is 32 routes and 12 helpers; no domain rule lives in it. But it commits its own transactions 24 times, and under [§1](#4-inside-a-package) it splits into `server/models/{routes,views}.py` — because every route file does, not because this one is large. See [§6.4](#124-views--every-handler-is-one-and-none-is-separated) |
| *"`runtime/` is split into its seven parts."* | **Half true.** `catalogue/` and `interpreter/` exist; fourteen files still sit loose at the top — `planning.py` · `services.py` · `models.py` · `stream.py` · `emissions.py` · `projections.py` · `routes.py` · `schemas.py` · `template_routes.py` · `contention.py` · `delegation.py` · `diagnosis.py` · `workflows.py` · `executor.py`. The target shape is [runtime.md §2](../modules/platform/features/runtime.md) |

On the second: finishing `planner/` · `state/` · `stream/` as folders is **no longer cosmetic** — it is
[§8 step 4](#16-order--one-package-at-a-time-smallest-first), and `runtime` has the engine's largest
queryset debt (≈36 leaked sites across 8 models, zero stores). Do the two together.

## 24. File sizes, for reference

Measured on the banded tree. Over ~40 KB is a folder by [code-shape §5](#4-inside-a-package).

| KB | File | Under §1 |
|---|---|---|
| 45 | `server/routes/models.py` | → `server/models/{routes,views}.py` · 32 views, 24 commits to remove |
| 42 | `runtime/interpreter/loop.py` | waits on the signals enum |
| 31 | `apps/modeller/store.py` | → `apps/modeller/querysets/` · 45 methods over 11 models |
| 26 | `core/auth/services.py` | → `core/auth/managers/` + `querysets/` |
| 25 | `server/admin/views.py` | already a `views.py`, and already right |
| 25 | `apps/graphs/services.py` | → `managers/` · minus `derive_setup_state` (§9.1) |
| 25 | `apps/datasets/importer.py` | takes a session → a manager |
| 24 | `apps/work/services.py` | → `managers/` + `querysets/` · 25 functions, 12 leaked sites |
| 22 | `runtime/services.py` | → `managers/` + `querysets/` · 18 functions |
| 19 | `apps/graphs/manager.py` | → `pool.py` · `ConnectionPool` (§5) |

