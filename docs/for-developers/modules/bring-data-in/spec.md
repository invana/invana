# Bring data in — module spec

Invana is a **destination**. Something else extracts and transforms; what arrives here is a dataset
that already conforms to a model. Loading it is a run like any other — same trace, same retries, same
failure vocabulary — and everything it writes carries the record it came from.

> ⚠ **Rewritten for [orchestration § 0](../../orchestration.md#0-the-records)** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> [task-model-migration.md](../../building-engine/task-model-migration.md).

| | |
|---|---|
| Index | [§2 · Bring data in](../../README.md#2--bring-data-in) |
| Features | [load-data](features/load-data.md) · [inspect-what-landed](features/inspect-what-landed.md) · [load-a-bundle](features/load-a-bundle.md) · [datasets](features/datasets.md) · [retract-and-refresh](features/retract-and-refresh.md) · [bind-a-dataset](features/bind-a-dataset.md) · [standards](features/standards.md) · [skos-import](features/skos-import.md) |
| Depends on | [Connect and model](../connect-and-model/spec.md) (a dataset binds to a model) · [Platform](../platform/features/runtime.md) (an import is a run the runtime walks) · [Workflows](../workflows/spec.md) (its plans are builtin library versions) |
| Depended on by | everything that answers from data |

Product spec: [Datasets](../../../../specs/products/datasets/product.md) — the product, its features DS-F01–F04, and the module-wide product rules and decisions live there. This file keeps the vocabulary and the engine shape.

System design: [bring-data-in.md](../../../../specs/system-design/modules/bring-data-in.md) — the contract, the import run, the entry points and when it goes wrong (§§ 2 · 3 · 5 · 6). This file keeps the vocabulary, what the module owns, its decisions, the drawn states and the retired Studio rows of §§ 2 · 5.

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Dataset** | install-wide, versioned tables from one source under one authorship; a Graph binds a version into a model ([2.4](features/datasets.md)) | a connection to a source · the records one load brought (those are the model's) |
| **Standard** | an install-wide, versioned set of terms — type, required, allowed values — a dataset claims and is scored against ([2.7](features/standards.md)) | a constraint on one model property · a rule |
| **Import run** | one load of a dataset — a Todo of kind `import` | a background job |
| **Validation report** | per-record accept or reject, with reasons | a summary count |
| **Provenance** | the dataset record every written node and edge points back to | a timestamp |

## 2. The contract

Stays here, retired — Upload in the browser mints dataset versions too:

| Rule | Detail |
|---|---|
| Studio does not write | Import is CLI and API only; Studio reads |

## 4. What this module owns

| Owns | Shape |
|---|---|
| `datasets` | `graph_id` · `model_id` · name · declared shape · created_by |
| the run | **no table of its own.** A load is `Todo(kind = import)` + `Run(plan = dataset-import@1)` + four `task_runs`, like every other run (BD12) |
| `validation_reports` | per run: accepted, rejected, and the reason per rejected record |
| Provenance | on every written node and edge: the dataset record it came from |

## 5. Entry points

Stays here, retired — imports are read in Data › Upload:

| Surface | Shape |
|---|---|
| Studio | read-only: the **Imports** journal — every run with its log, its report and who ran it; the dataset and its provenance are reached from a run |

## 7. Cross-feature decisions

| # | Decision |
|---|---|
| BD3 | An import run is a Todo — one runtime, one trace vocabulary, one failure story. |
| BD6 | Import is CLI and API; Studio reads what landed. |
| BD7 | An import opens `Todo(kind = import)` and a `Run(plan_origin = builtin:dataset-import@1)` whose four steps are `validate_records · write_graph · stitch · snapshot_model`. **The plan is fixed — nothing generates it**, because there is nothing for a model to decide about a load. Fixed means *not planned*; it never meant *not dispatched* (BD12). |
| BD8 | Studio grows no second run UI. An import's trace is the same step card an answer uses, because an import is a run. |
| BD9 | Studio's surface for this module is **Imports** — an audit journal of runs, newest first, across every dataset. The dataset hangs off the run that wrote it. The question after a load is *what happened*, and that question is answered in time order. |
| BD10 | The run carries its principal and its invocation, because an audit journal names who ran what. |
| BD11 | A run has a **kind**: `import` (validated, reported, traceable to the record) or `bulk` (`invana loader`, straight through the connector). Both are in the one journal, because what a person asks is *what changed my graph*; the kind is what stops the second from reading like the first. |
| BD12 | **A load owns no run machinery.** `import_jobs` folds into `todos` · `task_runs` · `task_runs`; its `logs` become `run_logs`; its `import.*` events become the closed `run.*` set; and its four stages become catalogue entries **the interpreter dispatches**. Writing step rows by hand is what made retries, timeouts, cancellation and approvals absent from imports. [13.8 RP29b](../platform/features/runtime.md) |
| BD13 | **A bulk run is a one-step plan, not an exception.** `bulk-load@1` runs `bulk_write`. No per-record validation and no provenance are properties of that step; they are not a reason for the run to live outside the runtime (BD11 · [13.8 RP29a](../platform/features/runtime.md)). |
| BD14 | `dataset-import@1`, `bundle-import@1` and `bulk-load@1` are **builtin workflow versions in the library**, not constants in this package — so `plan_origin` resolves and the trace can show the plan that ran. [§7 F9](../workflows/spec.md) |
| BD15 | **A bundle load is an ordinary workflow.** `bundle-import@1` maps over the datasets `stitches.json` already names, inlines `dataset-import@1` per lane, stitches once, and branches to `create_task` on a failed lane. No stage is a Task: nobody accepts a load. [2.3](features/load-a-bundle.md) · [13.8 §3.2](../platform/features/runtime.md) |
| BD19 | **The fast path names a model too; what it skips is validation, not the container.** `invana loader` writes records without checking them against anything, and it used to record that honestly by attaching them to a source with no model. With the model as the container ([BD16](#7-cross-feature-decisions)) that leaves the records nowhere: `_inv_model_id` is half the provenance key, and data that belongs to nothing cannot be traced, stitched or re-loaded. So `--model` says **where the records go** and is required on every path; validation is the thing the fast path opts out of, and the run says which of the two happened. A model that has never been validated against is still the thing the records conform to — or the load is the first evidence that it does not. |

## 7a. The drawn states

Hi-fi, at 1440×900, on the **Hi-fi · finance** page of the *Agents at Work Wireframes* canvas —
`claude.ai/code/artifact/58f2e380-ef59-41cd-8c96-d3dc7ddd06e4`.

The journal itself (BD9) is not drawn yet — these two artboards draw the run and the dataset
behind it.

| Artboard | Feature | Shows |
|---|---|---|
| Imports · what landed | [inspect-what-landed](features/inspect-what-landed.md) | the dataset list with its per-type counts, *Validated against `NewsArticles@v3`*, the *What landed* table, the last run's outcome with its rejection count, and the selected node's provenance line — dataset · file · record · run |
| Imports · the run | [load-data](features/load-data.md) | the same step card an answer uses, running `dataset-import@1` — `validate_records · write_graph · stitch · snapshot_model` — with where the folder came from, the rejection reason, and `Open trace · Open report · Cancel run` |

## 8. Deliberately absent

| Not built | Because |
|---|---|
| Import from Studio | a load is a scripted, repeatable act, not a click |
