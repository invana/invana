# Bind a dataset version into a model

A Graph takes one exact version of an install-wide dataset into one of its models; the bind is an ordinary
import run, so its records land validated, with provenance, and the trace is the one every load has.

| | |
|---|---|
| Index | [2.6](../../../README.md#2--bring-data-in) · Slice **B03** (P-08) |
| Module | [Bring data in](../spec.md) |
| API / CLI / Studio | 🟡 / 🟡 / ✅ |
| Related | [datasets](datasets.md) · [load-data](load-data.md) · [retract-and-refresh](retract-and-refresh.md) · products: [datasets.md](../../../../products/datasets.md) DS-11 · DS-F11 |

Product spec: [DS-F03 · Add a dataset to this graph](../../../../../specs/products/datasets/features/DS-F03-add-a-dataset-to-this-graph/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| `datasets.bind` | Studio — `BindDialog` from the dataset header: Graph → model · type from the model's active version, columns against the type's properties, then *Open the run* |
| `invana datasets bind <ds>@v --graph --model --type` | CLI |

## Engine

| Table | Columns |
|---|---|
| `dataset_bindings` | `id` · `graph_id` · `model_id` · `dataset_id` · `dataset_version_id` · `type_name` (unique `graph_id, model_id, dataset_id, type_name`) · `run_id` · `bound_by_id` · `bound_at` |

| Route (`/api/v1/u/{username}/{graphSlug}/dataset-bindings`) | Returns |
|---|---|
| `GET ""` | `DatasetBindingListResponse` |
| `POST ""` `{dataset: "publisher/name@v", model, type}` | 201 `DatasetBindingRead` — the run is submitted |

| Shape | Fields |
|---|---|
| `DatasetBindingRead` | `id` · `graph_id` · `model_id` · `model_name` · `type_name` · `address` (`publisher/name@v`) · `version` · `run_id` · `bound_by_id` · `bound_at` · `retracted: Retraction?` · `newer_version?` |

| Event | Details |
|---|---|
| `dataset.bind` (`target_kind = dataset`, `graph_id` set) | `address` · `version` · `version_id` · `model_id` · `type_name` · `run_id` · `from_version?` |

| Setting | Default |
|---|---|
| `INVANA_DATASET_DIR` | `.invana/datasets` — where a bound version's records are written as `<content hash>/<Type>/nodes/<Type>.json` |

## Decisions

| # | Decision |
|---|---|
| BV2 | **A bind is a load.** The version's records are written once as the load folder `INVANA_DATASET_DIR/<content hash>/<Type>/nodes/<Type>.json` — content-addressed, so a version is materialised once per type, and one folder per type because a load reads every file in `nodes/` — with the key column as `id`, and `open_load_run` opens the ordinary import run named `publisher/name@v`. Validation, provenance, stitching and the trace are the load's. |
| BV3 | **Who binds:** a member of the Graph who can read the dataset. Roles (P-18) narrow this to Builder and above. |
| BV5 | **A version's effect after is its bind loads.** `basis = "bound"` counts the runs the `dataset.bind` events of that version name, in every Graph, and their tokens — read from the events because a moved binding no longer holds its earlier version — loads spend none today, so tokens read 0. |
| BV6 | **The view opens and submits.** The bind opens the run in the request's transaction, commits, and submits it to the runtime — the shape the skill draw and the eval run already have. |
| BV7 | **A load the prologue refuses is 409, naming why** — no published model version, no connection, a read-only one. The version is already materialised by then, which is harmless: the folder is content-addressed and the next bind reuses it. No binding row is written for a refused bind. |

