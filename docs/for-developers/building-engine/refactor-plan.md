# The engine refactor — moving the tree without moving the contract

**Companion to [migration-plan.md](migration-plan.md).** That file says what the tree should look like; this
one says how to get there **without a single observable change** — no route, no schema, no field, no
model name, no table, no behaviour.

| | |
|---|---|
| The promise | Studio cannot tell the refactor happened |
| What may change | file locations and `import` statements |
| What may not | routes · response shapes · model and table names · column names · behaviour · anything stored · **anything `integrations/` imports** |
| Order of the *what* | [migration-plan §7](migration-plan.md#17-order-of-the-band-work). This file is the *how* |

## 1. Make the promise executable

Three golden files, committed **before** anything moves, checked on **every** commit. They are what
you are actually trusting — not the diff review, which for a mass move is not possible line by line.

| Guard | How | Catches |
|---|---|---|
| **OpenAPI snapshot** | dump `app.openapi()` to `tests/golden/openapi.json`; a test diffs it | any route, schema, field, enum or status code that moved. **This is the frontend contract** |
| **Models snapshot** | sorted DDL from `Base.metadata`, compiled for Postgres, in `tests/golden/schema.models.sql` | a table, column or index a **model** declares differently |
| **Migrated snapshot** | `alembic upgrade head` on an empty database, reflected back, in `tests/golden/schema.migrated.sql` | a table, column or index the **chain** builds differently — and that the chain runs at all |
| **The suite** | green before step 1 | behaviour |
| **Integrations untouched** | `grep -rhoE "invana\.[a-z_]+" integrations/ --include="*.py" \| sort -u` returns exactly `invana.graph` | a move that reached into a published connector package |

**If the OpenAPI diff is empty, the frontend cannot break.** That one fact reduces the whole refactor
to a mechanical exercise, and it is why phase 0 is not optional.

Regenerate all three with `uv run python -m tests.golden.update` — only when a change to the contract
is *intended*. A refactor step that needs it has moved something it was not supposed to.

### The two schema snapshots are pinned separately, and are not asked to agree

They already disagree: 66 server defaults, 4 nullability flags, 4 constraints and 8 indexes differ
between what the models declare and what the chain builds. That drift is real and predates this pass.
Pinning them as one file would have meant reconciling it first — a schema change, which is exactly
what this pass promises not to make. Two files, each catching a change to its own side, is the guard
that can exist today. Closing the drift is its own change, with its own migration.

### The guards run against Postgres, because SQLite is not a target

`alembic upgrade head` is green from empty on Postgres, to `000000000037`. It cannot run on SQLite,
and not for one fixable reason:

| Revision | Statement | Why SQLite rejects it |
|---|---|---|
| `000000000018` | `UPDATE sessions s … FROM session_messages m` | SQLite does not allow an alias on an `UPDATE … FROM` target |
| `000000000021` · `000000000022` | `alter_column(…, server_default=None)` | SQLite has no `ALTER COLUMN`; needs `batch_alter_table` |
| — | `run/models.py` · `agents/models.py` declare `JSONB` | a Postgres-only type: even `create_all` cannot target SQLite |

`aiosqlite` is not a dependency, every test fixture uses a Postgres schema, and `db.py` derives its
sync URL by stripping `+asyncpg`. **SQLite is not a supported app-state database today**, so the guard
targets the one that is. The golden schema test creates a scratch database next to the configured
one, migrates it, reflects it and drops it.

### `integrations/` is out of scope, and verified so

The five connector packages — `invana-neo4j` · `invana-memgraph` · `invana-arcadedb` ·
`invana-janusgraph` · `invana-tinkergraph` — are released separately and are not touched by this pass.

That is a **verified guarantee, not an assumption**: every `invana` import in `integrations/` is one
of eleven paths under `invana.graph`, and there is no bare `from invana import`. So freezing
`invana.graph` ([§2](#2-what-cannot-move-and-why)) is both **sufficient and necessary** — nothing else
in the tree is reachable from them.

The fourth guard above is what keeps that true as the tree moves. If it ever returns a second module
name, a move has reached somewhere it must not.

## 2. What cannot move, and why

> **A module path is a public identifier when it appears in data, on the wire, or in another
> package's `import`.**

It is the same class of thing as a column name, and it is the rule that is easiest to forget because
it is invisible to every import-aware tool — a linter that only sees this repo cannot see
`invana-neo4j` importing from it.

| Frozen | Where it leaks | Consequence |
|---|---|---|
| **`invana.graph`** | **imported by five separate pip packages** — `invana-neo4j` · `invana-memgraph` · `invana-arcadedb` · `invana-janusgraph` · `invana-tinkergraph`, eleven paths under `connectors/` and `types/`. Also stored in `connections.connector_class` (`String(512)`), returned by `server/routes/models.py`, accepted by `invana loader --connector-path`, shown in admin | it is **not moving anyway** — it is the graph engine and keeps its own band ([migration-plan §3](migration-plan.md#2-the-bands)). But it is a **published Python API**: moving it breaks installed connectors at import time, in packages this repo does not release |
| `task_key` | `task_runs` column · `RunStepRead` · `studio/src/types/work.ts:343` and three components | rename is a migration plus a frontend change |
| Span and metric names — `invana.graph`, `invana.llm`, `invana.llm.model_id` | `get_tracer(...)`, `set_attribute(...)` | dashboards and alerts key on them. **Leave them literal even when they no longer match the package path** |
| `"invana.model/1"` · `"invana.bundle/1"` | exported artefact headers | they are format tags, not module paths. Unrelated, and unchanged |

`invana.graph` stays put for a design reason first — it is the graph engine, its own band, and
folding it into `core` would file a database engine next to the log configuration. The stored path
simply means the decision costs nothing to keep.

**`invana.apps.graphs` is the one that moves**, and it is a different thing entirely: the application
layer over a Graph — the entity, its members, its settings. Its module path is not stored anywhere,
so it moves freely.

## 3. The rules, per commit

| Rule | Why |
|---|---|
| One commit = **one move** *or* **one fold**. Never a move plus a rewrite of something else | a diff mixing relocation with change cannot be reviewed |
| A move and its import rewrite are **the same commit** | there are no shims. The tree must import cleanly at every commit |
| Always `git mv` | history and blame follow the file |
| No file's **contents** change except its `import` lines | if a body changed, it is a different commit, in a different pass |
| All four guards run on every commit | green is the merge condition, not a nice-to-have. `lint-imports` and the `integrations/` grep are pre-commit hooks; the golden diffs are a CI job with a Postgres service |
| Run the string grep (§5) before each move | imports are the easy half |
| Search `integrations/` too, not just `engine/` | five pip packages import from this tree. `packages = ["src/invana"]` ships everything, so packaging needs no change — but their imports do |

## 4. The phases

### Phase 0 · Guards — nothing moves ✅

| # | Step |
|---|---|
| 0.1 | Confirm `alembic upgrade head` runs from empty. It does, on Postgres — see [§1](#1-make-the-promise-executable). No migration is edited |
| 0.2 | Green the test suite. `tests/graphs` was written against a `GraphCreate` that no longer exists and a SQLite engine with no driver; it is rewritten against the Graph / GraphConnection split. Suites that need a service — Ollama, Gremlin — **skip** when it is absent rather than erroring, so a red run means a regression |
| 0.3 | Commit `tests/golden/openapi.json`, `schema.models.sql` and `schema.migrated.sql`, with the tests that diff them |
| 0.4 | Add `import-linter` with the three contracts from [migration-plan §4.2](migration-plan.md#32-enforcement), and **today's violations allowed by name**, each annotated with the step that closes it |

**What the linter can and cannot see.** It names the 19 cycles that are in the import graph. The
other 13 were never in it: they all ran through `modeller/migrations/env.py`, and `migrations/` has
no `__init__.py`, so `grimp` never walked it. [1.2](#phase-1--core-) closes them anyway, by moving
`Base` out from under them.

`core/migrations/env.py` still imports every model — that is how alembic populates the metadata it
autogenerates against. It is a script, not a module in the import graph, so the band rule neither
sees it nor needs to. **This is the one place in `core` that names an app, and it is allowed to.**

### Phase 1 · `core` ✅

| # | Move | Watch for |
|---|---|---|
| 1.1 | `settings.py` · `db.py` · `utils.py` → `core/` | nothing imports them back. Safest first move |
| 1.2 | `Base` and `migrations/` out of `modeller` → `core/models.py` · `core/migrations/` | `alembic.ini:8` `script_location = %(here)s/src/invana/modeller/migrations` → `.../core/migrations`; `env.py`'s `target_metadata` import. Grep the migration files for `from invana` before starting — most reference tables as strings and are unaffected, but not all may |
| 1.3 | `logging/` · `telemetry/` → `core/` | keep every tracer, meter and **logger** name literal — `get_tracer("invana.core")`, `getLogger("invana.telemetry")`, `getLogger("invana.api")` are stream identifiers, not package paths. But `logging/config.py`'s `dictConfig` names its filter and formatter **classes** by dotted path; those are imports written as strings and must follow the move |
| 1.3a | `telemetry/routes.py` → `server/routes/` | **`core` has no routes** ([migration-plan §4](migration-plan.md#3-the-rule)). The OTLP proxy is the same case as `events/routes.py` at 1.6, found when telemetry moved in. Same URL, same handler, new home |
| 1.4a | `auth/routes.py` → `server/routes/` | **`core` has no routes.** Done before the move in, so `core` is never briefly wrong |
| 1.4b | `auth/` → `core/auth` | the rest of `auth` is already core-clean: `jwt` · `passwords` · `tokens` · `models` · `deps` · `schemas` import nothing but `core` and `events` |
| — | the membership check out of `auth/services.py` into `graphs` | **not a pure relocation, and not in this phase** — see below |
| 1.5 | `events/routes.py` → `server/routes/` | **`core` has no routes.** Done before the move in, so `core` is never briefly wrong. Every URL identical — the OpenAPI diff proves it |
| 1.6 | `events/` → `core/events` | `models` · `actions` · `schemas` · `notify` · `services` are clean. `store.py` keeps its `Agent` join, named — see below |
| — | `graph/` | **not in this phase and not in `core`.** It keeps its own top-level band |
| — | splitting the event **reader** out of `core` | **not in this phase** — see below |

`core` is now `settings · db · utils · models · migrations · logging · telemetry · auth · events`,
and **no package in it has a `routes.py`**. Nineteen top-level packages became sixteen. `graph/` is
untouched, one band above.

Two allowances remain on `core is independent`, both annotated with what closes them, neither of
them a move:

| Edge | Closes with |
|---|---|
| `core.auth.services -> graphs.models` | the `MembershipReader` protocol, [migration-plan §7 step 7](migration-plan.md#171-now--each-closes-something-measured) |
| `core.events.store -> agents.models` | capturing the principal's name at write, [10.2](../modules/operate/features/audit-and-activity.md) |

#### Why the event reader does not come out here

`EventStore.list_page` joins `Agent` to resolve an actor's display name while
paginating the audit list. That is the read-time lookup
[migration-plan §4.0](migration-plan.md#30-what-blocks-the-move-into-core-measured) flags, and the doc gives
its own fix: **capture the name at write**, as [10.2](../modules/operate/features/audit-and-activity.md)
already specifies. That fix is a behaviour change plus a backfill, which [§7](#7-what-this-pass-deliberately-leaves)
defers out of this pass on purpose.

The alternative — splitting the reader into an app — needs a destination the target tree does not
have. [migration-plan §6](migration-plan.md#10-package--module-correspondence) says *"the activity tree that
reads it is an app"*, and that part is already true: `work/activity.py` builds the per-task tree.
The audit **list** is a different reader with no named home, and
[migration-plan §8](migration-plan.md#21-guardrails) requires a package to declare its band in that file
before it is created. Naming a new app is a design decision, not a move.

So `events` moves in whole, with `store.py -> agents.models` named in the contract and annotated
with the change that removes it. **One edge, visible, with an owner** — rather than a new package
invented mid-refactor to hide it.

#### Why the membership check does not come out here

[migration-plan §4.0](migration-plan.md#30-what-blocks-the-move-into-core-measured) sizes this as *"one
function"*. It is two, and the size is not the problem — the direction is.

| | |
|---|---|
| `_list_memberships` | reads `GraphMember` to fill `UserOut.graphs` |
| `_owns_any_graph` | counts `Graph` to guard account deletion |
| Called by | `_user_out`, which builds **every** auth response — login, register, refresh, me, patch me |

Relocating the two functions into `graphs` does not remove the edge, it renames it: `auth` would
import `graphs.services` instead of `graphs.models`. The edge only disappears if the *composition*
moves above `auth` — and `UserOut.graphs` is a response field, so it cannot simply stop being
populated.

**That is the `MembershipReader` shape, and it is [§7 step 7](migration-plan.md#171-now--each-closes-something-measured)** — a protocol in `core`, implemented by
`graphs`, wired in `server/deps.py`. A protocol is added to break a measured cycle, which this is;
it is not added in a pass whose promise is that nothing changes. `auth` moves into `core` with the
edge named in the contract, and the allowance is deleted when step 7 lands.

### Phase 2 · `apps/` ✅

| # | Move | Watch for |
|---|---|---|
| 2.1 | Create `apps/`; `git mv` all thirteen domain packages in — `graphs` (the application layer, **not** `graph`) · `modeller · canvases · explorer · datasets · sessions · skills · agents · workflows · work · llm · llm_providers · projects` | one commit, one rewrite. Large, unreviewable line-by-line, and entirely dependent on phase 0 |

**They go in flat, as siblings.** The plan previously nested two of them —
`llm_providers` → `apps/llm/providers` and `projects` → `apps/work/projects` — as relocations that
*enable* the later merge. Nesting is dropped:

| Why | |
|---|---|
| `apps/llm/providers` is **already taken** | `llm/providers/` holds the four provider *clients* (anthropic · claude_agent_sdk · ollama · openai). `llm_providers/` holds the stored *configuration*. Two different things cannot share the path |
| Naming is the merge's decision, not the move's | which of the two is "providers" is a [terminology](../terminology.md) question. Settling it inside a pass that promises nothing changes would smuggle a rename into a path rewrite |
| A flat sibling costs nothing | `apps/llm_providers` and `apps/projects` are the same move as the other eleven, and the merge at [migration-plan §7 step 6](migration-plan.md#171-now--each-closes-something-measured) re-homes them when it picks the names |

So phase 2 is **one step, not three**. The `llm ↔ llm_providers` and `projects ↔ work` allowances
stay, named, until step 6 folds them.

**Frozen through this move.** `invana.llm` is a span name and the prefix of six metric names
(`invana.llm.request.duration`, `.request.count`, `.request.errors`, `.requests_in_flight`,
`.tokens.input`, `.tokens.output`) plus three span attributes. Per [§2](#2-what-cannot-move-and-why)
they stay literal even though the package becomes `invana.apps.llm`. The §5 string grep is what
catches a rewrite that touched them.

### Phase 3 · `runtime` ✅

| # | Move | Watch for |
|---|---|---|
| 3.1 | `run/` → `runtime/` | the package name is not a public identifier — it appears in no column, no response and no stored value. Confirm with the §5 grep |
| 3.2 | Split `runtime.py` (47 KB) and `tasks.py` (47 KB) | **the same symbols, relocated.** `__init__.py` re-exports every public name; no function body is edited |

**Where the seven parts of [§2](../modules/platform/features/runtime.md) actually landed.** A part
becomes a folder when it has more than one file's worth of code — the rest stay modules:

| Part | Lands as |
|---|---|
| Catalogue | `catalogue/` — `contract` · `intent` · `query` · `modelling` · `work`, one module per step group |
| Interpreter | `interpreter/` — `loop` (the `RunRuntime` class) · `payloads` (row and message shaping) |
| Executor | `executor.py` — one function. §2 says it stays one function behind one protocol |
| Planner | `planning.py` — already its own module |
| State | `models.py` · `services.py` — already their own modules |
| Stream | `stream.py` — already its own module |
| Artifacts | **not built.** [migration-plan §20](migration-plan.md#20-open-questions) |

`interpreter/loop.py` is still 43 KB, and stays one class. Splitting a class across modules needs
mixins, which is a restructuring rather than a move. What actually shrinks it is
[§21 step 4](../modules/platform/features/runtime.md#21-how-this-lands) — `_loop` returning and
honouring one signals enum instead of seven exception types — and that is a behaviour change, so it
is not in a pass that promises none.

**The registry keys did not move.** The fourteen `TASKS` keys are the plan vocabulary, stored in
`task_runs.task_key` and read by Studio. A step changing module inside `catalogue/` changes
nothing a plan or a row can see, and the package docstring says so.

### Phase 4 · Close ✅

| # | Step |
|---|---|
| 4.1 | Delete the phase-0 allowances, one per cycle actually closed. **Done in the commit that closed each** — four deleted, never accumulated. `import-linter` fails on an allowance that matches nothing, so a stale one cannot survive a commit and the remaining 29 are all live |
| 4.2 | Record which cycles remain and why → [migration-plan §9](migration-plan.md#15-what-is-left-and-why) |

**14 of the 32 cycles closed.** 13 with `Base`, 1 with `events/routes.py`. The other 18 each need a
behaviour change, a protocol or a merge — none is an accident of placement any more, and each is
named in the contract with the change that removes it.

## 5. Verifying a move

Imports are the easy half. Run all four before calling a move done:

```bash
# 1 · no import of the old path survives — note integrations/, not just engine/
grep -rn "from invana\.<old>\|import invana\.<old>" engine/ integrations/

# 2 · no module path written as a string
grep -rn "\"invana\.\|'invana\." engine/ \
  --include="*.py" --include="*.toml" --include="*.ini" --include="*.cfg"

# 3 · the contract is untouched
pytest tests/golden/           # openapi + schema diff

# 4 · everything still passes
pytest && lint-imports
```

A red golden diff is **never** fixed by rerunning `tests.golden.update`. Find what moved first.

Grep 2 is the one that catches what the others cannot — it is how `invana.graph` was found to be
load-bearing data, and it is the check most likely to be skipped. Run it before **every** move, not
just the ones that look risky.

## 5a. What this pass actually changed

| | Before | After |
|---|---|---|
| Top-level packages | 22 | **6** — `core` · `graph` · `apps` · `runtime` · `server` · `cli` |
| Two-package cycles | 32 | **18** |
| Files over 40 KB | 2 (`runtime.py` 47 KB · `tasks.py` 47 KB) | **1** (`interpreter/loop.py` 43 KB, one class — see [§21 step 4](../modules/platform/features/runtime.md#21-how-this-lands)) |
| Packages in `core` with a `routes.py` | 3 | **0** |
| Routes · response shapes · tables · columns · behaviour | — | **unchanged, and proved so on every commit** |

## 6. If a step goes wrong

| | |
|---|---|
| Each commit is self-contained | `git revert` of one commit leaves a green tree |
| No shims means no half-migrated state | there is never a window where two paths resolve to one module |
| A red golden diff is a stop, not a rebase | if OpenAPI changed, something moved that was not supposed to. Find it before continuing |

## 7. What this pass deliberately leaves

Each is worth doing. None belongs in a pass whose promise is *nothing changes*.

| Left | Needs |
|---|---|
| `task_key` → `step_key` | a migration and a coordinated Studio change |
| `events` capturing the principal name at write | a behaviour change and a backfill — it closes a real gap against [10.2](../modules/operate/features/audit-and-activity.md) |
| `core/contracts.py` with `RunOpener` and `EnvelopeCheck` | same behaviour, different call path. The five genuine cycles survive this pass |
| Merging `llm_providers` into `llm`, `projects` into `work` | phase 2 puts them in place; merging them is code |
| Everything in [migration-plan §20](migration-plan.md#20-open-questions) | a measured reason |

**After this pass the tree is right and the cycles are mostly gone. What is left above is each its
own change, with its own migration.**
