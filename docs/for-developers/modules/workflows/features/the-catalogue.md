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

> **As** someone reading a plan or a refused run, **I want** the contract of the step in front of me,
> **so that** I can tell what it was allowed to do without reading the engine.

## Why it is a surface at all

A catalogue entry is already an artifact with four readers — the planner, the validator, the
interpreter and every `${steps.x.y}` binding ([§ 0.6](../../../orchestration.md#06-the-catalogue--what-a-plan-may-name)).
This adds a fifth: **a person**. Three questions have no other answer today.

| Question | Where it is answered without this |
|---|---|
| *What does `graph.read.validate` actually check, and what does it hand on?* | the engine source |
| *Why was this plan refused with `graph_write not in envelope`?* | the error string alone |
| *What can the system do — what is the whole vocabulary?* | nowhere |

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C1 | Every entry, **grouped by the bound it spends** | The group is the thing the envelope ceilings — grouping is not cosmetic |
| C2 | An entry's contract: `bound` · `args` · `outputs` · `requires` | The declaration, rendered — never a second copy of it |
| C3 | An output row states its **lane roll-up** | `sum` · `concat` · *not exposed on a fan-out* — the type *is* the rule ([§ 5.1b](../../../orchestration.md)) |
| C4 | `requires` reads as an ordering statement | *"a plan naming this must already order `graph.read.validate` before it"*, linking to that entry |
| C5 | **Used by** — which reusable plans name this entry | The reverse of a plan's step list; a plan row opens [7.1](the-library.md) |
| C6 | Which agents may spend this bound | From the envelopes — the bound is what an envelope grants ([7.3](envelope-validation.md)) |
| C7 | Read-only, and it says so | The set is closed and ships with the engine; nothing here adds, edits or disables an entry |
| C8 | Search across key, summary and bound | Twenty-odd entries — search is a convenience, not the navigation |
| C9 | **Each row says how many plans name it** | Which makes an unused callable visible, and the one five plans depend on too — the reverse of C5, on the list rather than in the detail |

## Journey

```mermaid
flowchart TD
    A{Arriving from} -->|browsing| B["leftNav › Tasks › Catalogue"]
    A -->|a step in a run| C["Run detail › a Task row › its step_key"]
    A -->|a step in a plan| D["Plans › a plan › a step"]
    A -->|a refusal| E["Refused: graph_write not in this envelope"]

    B --> F[Grouped by bound · none · network · graph_read · …]
    C --> G
    D --> G
    E --> G[Entry detail]
    F --> G

    G --> H["bound · args · outputs · requires"]
    H --> I{Follow what?}
    I -->|what must come first| J["The required entry"]
    J --> G
    I -->|who uses it| K["Plans naming it · 7.1"]
    I -->|who may spend this bound| L["Agents whose envelope grants it · 7.3"]
    I -->|what it produced last| M["Runs whose Tasks ran it · 10.5"]
```

## Seams

| Seam | What the user sees |
|---|---|
| An entry no plan uses | *Used by* is empty and says so — a callable nobody composes is a fact, not an error |
| A plan naming an entry this engine version does not have | The plan's step row is marked unknown and links here to *no such entry*; the plan is unrunnable and the library row says why |
| An entry whose bound no agent in the Graph is granted | Stated on the entry: nothing here can run it until an envelope grants the bound |
| An output not exposed on a fan-out | The row says *per lane only — bind it inside the lane*, rather than omitting it |
| A member reading a bound they cannot spend | The whole catalogue is readable by every member; it is a contract, not a permission |

## Surfaces

| Surface | Shape |
|---|---|
| **Catalogue** drawer | The third drawer of the **Tasks** stack ([G33](../../../building-studio/graph-detail-page.md)). Rows grouped under their bound, the group header carrying the bound and its count. A row is `step_key` (mono) · one-line summary · **how many plans name it**, or `unused`. The main column stays empty and says why an entry opens no page (CA6) |
| Function page | `agents.functions.detail` (CA6): tabs Contract · Used by · Calls, the head and the 30-day tiles |
| The contract, where it is used | The same fields render as the **contract card** beside a selected step's arguments, and inside a refusal. That is where an entry is actually read |
| Deep links | A task on a run's canvas and a task on a plan's canvas both link to `?panel=library&section=catalogue&entry=<step_key>` — the refusal message links to the same place |

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

| # | Decision |
|---|---|
| CA1 | **The catalogue is read-only in the product.** The set is closed and ships with the engine — that closure is what makes an envelope a bound rather than a suggestion, and a UI that could add, edit or disable an entry would be the hole ([§ 0.6](../../../orchestration.md#06-the-catalogue--what-a-plan-may-name)). |
| CA2 | **It is rendered from the declaration, never re-described.** No prose copy of an entry's args lives in Studio or in docs; the route serves the task manifests, and an entry that changes changes there first. |
| CA3 | **Grouped by bound, not alphabetically.** The bound is what the envelope ceilings and what a refusal names, so the group a person scans is the group the system enforces. |
| CA4 | **A drawer of Tasks, not an icon.** A run is an execution of a plan; a plan is a composition of catalogue entries — the catalogue is the bottom of that same sentence, and it is where *this run → the plan it ran → the callable that failed* ends ([G33](../../../building-studio/graph-detail-page.md)). |
| CA6 | **A function has a page**, opened from the Catalogue tab as a workbook tab crumbed `Functions › <key>`. The head is the dotted name, its bound, its side effect, its plugin `name@version`; the tabs are **Contract** (arguments, returns with each fan-out rule, *Must come after*, *Runs as*; beside them *Calls · 30 days* — calls, p95, failed — and *Needed by skills*) · **Used by** (the reusable plans that name it and the skills that need it) · **Calls** (the run steps that called it, newest first). Every number is the engine's, over this Graph's runs |
| CA7 | **An entry's summary is declared on the entry.** `summary` is one line in the task type's `manifest.toml`, and the route serves it — not a docstring parsed at read time, and not a string in Studio. A golden test refuses an entry without one. |
| CA8 | **A function is named `namespace.verb`.** The namespace names what it touches (`graph.read`, `graph.stitch`, `graph.write`, `data`, `model`, `nl`, `plan`, `work`, `answer`, `web`, `mail`, `science`, `sim`, `mcp.<server>`); the bound stays a property of the function, since one namespace spans bounds (`graph.stitch.preview` reads, `graph.stitch.commit` writes). The map is [agent-fabric › The function library](../../../../products/agent-fabric.md#the-function-library). The route, a refusal and Studio show the dotted name; no old key is kept as an alias. |
| CA9 | **Studio says *function*.** Every label, header, empty state and count that said *task type* or *callable* says *function* — *Functions* on a plugin, *No such function*, *Skills & functions* on an agent, *5 functions* on a plan. The read shapes that still carry the old word (`task_types` on a plugin, `…/skills-and-callables`, board kind `task_type`) are renamed with the surfaces that replace them, not before. |
| CA10 | **A function's numbers are its steps', in this Graph.** *Calls* counts run steps whose `task_key` is the function over the last 30 UTC days, eval runs left out; *p95* is queued-to-finished over settled steps; *failed* is failed over settled. The prior window is the 30 days before, and each change is `invana.core.metrics`' reading. *Needed by skills* lists the skills whose current version's plan names the function |
| CA5 | **Control flow is not in the catalogue.** `if` · `loop` · `map` · `retry` · `stop` are plan grammar ([§ 5](../../../orchestration.md)); they are documented with the plan, and a person looking for them here is told where they live rather than shown an entry that does not exist. |

## Not building

| Not building | Because |
|---|---|
| Registering an entry from an app, or while plans run | the set is closed per process — task types come only from the plugins loaded at start-up ([13.9](../../platform/features/plugins.md)); an app that could register one would make the envelope advisory ([the-runtime-package.md](../../../building-engine/the-runtime-package.md) §1) |
| Enabling / disabling an entry per Graph | the bound is the knob, and it is the envelope's ([7.3](envelope-validation.md)) — a second switch would have two answers to *may this run* |
| *Try it* — a playground that executes an entry | a callable runs inside a plan, under an envelope, with a run row behind it; a bare invoke is a write with no trace |
| *Allowed by policies* on a function's page | Policies are IAM's (I01) |
| Editing `requires` | it is part of the entry's contract, read by the planner while drafting — a Graph-level override would make a plan legal in one Graph and refused in the next |
