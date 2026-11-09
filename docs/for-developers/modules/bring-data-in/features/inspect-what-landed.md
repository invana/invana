# Inspect what landed

Every load leaves a run, a report and provenance. Studio reads all three, so "where did this number
come from" ends at a record and not at a shrug.

> ⚠ **Rewritten for orchestration § 0** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> task-model-migration.md.

| | |
|---|---|
| Index | [2.2](../../../README.md#2--bring-data-in) · Slice **S6** |
| Module | [Bring data in](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [load-data](load-data.md) · [reasoning-trace](../../ask/features/reasoning-trace.md) · [see-what-ran](../../operate/features/see-what-ran.md) |

Product spec: [DS-F02 · Bring data in](../../../../../specs/capabilities/datasets/features/DS-F02-bring-data-in/feature.md) — DS-13; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| **Imports** — a filter, not a panel | [Runs](../../operate/features/see-what-ran.md) (the **Tasks** stack's first drawer) with `kind in (import, bulk)` preselected. **No `leftNav` item of its own** ([SR7](../../operate/features/see-what-ran.md) · G30): one row per run — status, dataset, `model@v3`, `written / total`, duration, when. Filters: status · dataset · model · time. Status bar: run count, reported count, *import is CLI and API* |
| Run detail | Five blocks, in the order the audit reads: **Outcome** · **Steps** (`dataset-import@1`; for a `bulk` run, what the fast path did not do) · **Reported** · **Log** · **What landed**. Actions: `Open trace · Open dataset`. No cancel: this surface never writes (IW3), and a run is stopped where it was started |
| Dataset detail | Reached from a run's *What landed* — *Validated against*, per-type counts, provenance. Not a list of its own |
| Node inspector | `news-tv · nodes/Article.json · record #12,377 · run 9c1e` — dataset, file, record, run, in that order |

## Engine

| Thing | Shape |
|---|---|
| `todos` · `task_runs` · `task_runs` | the run, filtered to `kind in (import, bulk)`; read-only here |
| `validation_reports` | written by the load; read-only here |
| `run_logs` | the structured lines the load wrote; read back per run, level-filtered server-side ([13.8 §17](../../platform/features/runtime.md)) |
| Principal and invocation | recorded on the run — who ran it, and the command it came from |
| Provenance lookups | node → record, record → written elements |
| Routes | `GET …/imports` — an alias of `GET …/task_runs?kind=import` (graph-wide, newest first, filterable) · `GET …/imports/{id}` · `GET …/imports/{id}/report` · `GET …/records/{id}/wrote` |

## Decisions

| # | Decision |
|---|---|
| IW1 | Every written element resolves to the record that created it. The Inspector reads the stamps off the element it already has — `_inv_model_id` · `_inv_record_id` · `_inv_file` · `_inv_run_id` — so the block needs no request. **The model is what a record belongs to** ([BD16](../spec.md)); there is no second record between a model and its data, so the line names the model, the file and the record, and the run beneath it. An element with no stamps was written by `invana loader`, which validates nothing and stamps nothing, and the block says so rather than showing an empty table. |
| IW7 | Studio's surface is the **Tasks** stack's `Runs` drawer with `kind in (import, bulk)` preselected — the Graph's one journal ([10.5](../../operate/features/see-what-ran.md)), across every dataset, newest first. One implementation, one filter, **and no icon of its own**: *Imports* is the name of a filter, reached from the kind chip, from a Todo, or from a saved filter. A dataset is reached from the run that wrote it; it is not a list of its own. What a person wants after a load is what happened, in time order. |
| IW11 | `invana loader --graph <ref>` opens a run of kind `bulk` — `bulk-load@1`, one step, `bulk_write` — with counts, a trace and who ran it, and no claim of an audit: nothing it wrote was validated and nothing carries provenance. A load that wrote fifty thousand nodes is not invisible to the person who has to account for them; what it cannot do is pretend it was checked. Describing the database on the command line instead keeps the direct path and is not journaled — replaying such a run would need credentials, and credentials never ride a run's `params` ([LD10](load-data.md)). The command says so where it can still be acted on. |
| IW12 | The journal pages by keyset, not offset. Runs arrive while a person is reading, and an offset would show them a row twice or skip one. |

## Not building

| Not building | Because |
|---|---|
| A data browser over the whole graph | that is the Explorer's job |
| A journal across Graphs | everything is Graph-scoped; a cross-Graph audit is a different product |
