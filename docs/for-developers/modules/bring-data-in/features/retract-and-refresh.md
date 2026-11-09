# Retract and refresh a dataset

A withdrawn version is kept and marked, and everything that cites it is flagged; a dataset on a refresh
schedule mints new versions while its consumers stay pinned to the one they chose.

| | |
|---|---|
| Index | [2.5](../../../README.md#2--bring-data-in) · Slice **B03** (P-08) |
| Module | [Bring data in](../spec.md) |
| API / CLI / Studio | ✅ / 🟡 / 🟡 |
| Related | [datasets](datasets.md) · [bind-a-dataset](bind-a-dataset.md) · [schedules](../../operate/features/schedules.md) · products: datasets.md DS-03 · DS-14 · DS-F14 · DS-F15 |

Product spec: [DS-F01 · Datasets and their versions](../../../../../specs/capabilities/datasets/features/DS-F01-datasets-and-their-versions/feature.md) — DS-03 and DS-14; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| `datasets.dataset.used` · `datasets.dataset.retracted` | Studio — the dataset's `used` tab, the retraction banner on Overview, *Retract* on Versions for an install Admin |
| `invana datasets retract <ds>@v --reason` · `refresh <ds> --schedule "<cron>" --source <path>` · `refresh <ds> --now` | CLI |

## Engine

| Route (`/api/v1/datasets/{publisher}/{name}`) | Returns |
|---|---|
| `POST /versions/{v}/retract` `{reason}` | `DatasetVersionRead` |
| `GET /versions/{v}/used` | `DatasetVersionUsage` |
| `PATCH ""` `{refresh_schedule, refresh_source}` | `DatasetRead` |

| Shape | Fields |
|---|---|
| `DatasetRetract` | `reason` (1–500) |
| `Retraction` | `at` · `by_id` · `reason` |
| `DatasetVersionUsage` | `address` · `retracted: Retraction?` · `bindings: DatasetBindingRead[]` · `derived: DatasetVersionRef[]` |
| `DatasetVersionRef` | `address` · `version_id` · `dataset_id` |

| Event | `target_kind = dataset` | Details |
|---|---|---|
| `dataset.retract` | `graph_id` null | `version` · `reason` |

## Decisions

| # | Decision |
|---|---|
| DR3 | **Flags are read, not stored.** `used` lists the bindings of the version and the dataset versions whose `derived_from` names it; a binding read and a version read carry their retracted inputs. Findings, decisions and reports join this list with B05, the owners' Inbox item with B08, and a rule that blocks decisions on retracted data with B04. Until then the `dataset.retract` event is the signal. |
| DR5 | **A refresh schedule is a 5-field cron and a source** on the dataset, set by its owner; setting or clearing it is `dataset.update`, not a version. A schedule without a source is refused. |
| DR6 | **The engine never reads a caller-named path or URL over HTTP** — that is a file-read hole. The API stores the schedule and the source; the firing reads it. 10.1 Schedules is not built, so `invana datasets refresh <ds> --now` is the caller, the same stand-in `invana evals drift` is for nightly drift. |
| DR10 | **The flags ride on the reads.** A version read carries `retracted_inputs` (the addresses in `derived_from` that are retracted); a binding read carries its version's `retracted` (`Retraction?`, with when, who, why). |

