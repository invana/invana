# Read the catalogue

The closed set of callables a plan may name, with what each one **spends**, **takes**, **produces**
and **must be ordered after**. It is the vocabulary every plan in the Graph is written in — so it is
the page you read when a plan step is unfamiliar, when a plan was refused, or when you want to know
what the system is able to do at all.

| | |
|---|---|
| Index | [7.6](../../../README.md#7--workflows) · Slice **S12c** |
| Module | [Workflows](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 — the list, search and the contract detail ship; *Used by* plans (C5) and *granted to* (C6) do not yet |
| Related | [the-library](the-library.md) · [envelope-validation](envelope-validation.md) · [plan-selection](plan-selection.md) · [the runtime](../../platform/features/runtime.md) · [orchestration § 0.6](../../../orchestration.md#06-the-catalogue--what-a-plan-may-name) |

Product spec: [AG-F06 · Plans and functions](../../../../../specs/products/agents/features/AG-F06-plans-and-functions/feature.md) — AG-38 · AG-31; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

The declaration already exists — one `manifest.toml` per task type in the core plugins
([13.9 Plugins](../../platform/features/plugins.md)), twenty-eight across seven bounds today. This feature is a **read route over it**, and nothing else.

| Thing | Shape |
|---|---|
| Source | `invana.plugins.load_plugins()` — the frozen registry, re-exported as `invana.runtime.catalogue.CATALOGUE`; derived nowhere else |
| Entries | Declared in the engine, not registered by the feature that needed them ([CA1](#decisions)) — folding a flow into the runtime means *declaring its function*, never *opening the set* |
| `GET …/catalogue` | Every entry: `step_key · bound · summary · args · outputs (with rollup) · requires · used_by`, ordered by bound then key. Graph-scoped only so *used by* and *granted to* can be answered. `used_by` counts this Graph's reusable plan **keys**, not versions |
| `GET …/catalogue/{step_key}` | `FunctionRead` — the entry's fields, its manifest (`version` · `side_effect` · timeout · retries · resources; the line it reads by is the entry's `summary`), `plugin` (`name@version`), `plans[]` (reusable plans naming it: id · key · name · origin), `needed_by[]` (skill_id · name · version), `calls` (`calls` · `calls_prior` · `p95_ms` · `p95_prior_ms` · `failed` · `failed_rate` · each change) — CA10. 404 for an unknown key |
| `GET …/catalogue/{step_key}/calls` | `Page[FunctionCallRead]` on the list contract — `id` (the step) · `run_id` (its root) · `title` · `status` · `duration_ms` · `tokens` · `queued_at`, newest first; `f.status` filters |
| Cache | The entry list is engine-static: it is versioned with the engine build and served from memory |

## Decisions

Engine rows, and rows that stay until their surfaces are re-specified; the product decisions are AG-F06's.

| # | Decision |
|---|---|
| CA2 | **It is rendered from the declaration, never re-described.** No prose copy of an entry's args lives in Studio or in docs; the route serves the task manifests, and an entry that changes changes there first. |
| CA4 | **A drawer of Tasks, not an icon.** A run is an execution of a plan; a plan is a composition of catalogue entries — the catalogue is the bottom of that same sentence, and it is where *this run → the plan it ran → the callable that failed* ends ([G33](../../../building-studio/graph-detail-page.md)). |
| CA7 | **An entry's summary is declared on the entry.** `summary` is one line in the task type's `manifest.toml`, and the route serves it — not a docstring parsed at read time, and not a string in Studio. A golden test refuses an entry without one. |
| CA8 | **A function is named `namespace.verb`.** The namespace names what it touches (`graph.read`, `graph.stitch`, `graph.write`, `data`, `model`, `nl`, `plan`, `work`, `answer`, `web`, `mail`, `science`, `sim`, `mcp.<server>`); the bound stays a property of the function, since one namespace spans bounds (`graph.stitch.preview` reads, `graph.stitch.commit` writes). The map is [agent-fabric › The function library](../../../../products/agent-fabric.md#the-function-library). The route, a refusal and Studio show the dotted name; no old key is kept as an alias. |
| CA9 | **Studio says *function*.** Every label, header, empty state and count that said *task type* or *callable* says *function* — *Functions* on a plugin, *No such function*, *Skills & functions* on an agent, *5 functions* on a plan. The read shapes that still carry the old word (`task_types` on a plugin, `…/skills-and-callables`, board kind `task_type`) are renamed with the surfaces that replace them, not before. |
| CA10 | **A function's numbers are its steps', in this Graph.** *Calls* counts run steps whose `task_key` is the function over the last 30 UTC days, eval runs left out; *p95* is queued-to-finished over settled steps; *failed* is failed over settled. The prior window is the 30 days before, and each change is `invana.core.metrics`' reading. *Needed by skills* lists the skills whose current version's plan names the function |
