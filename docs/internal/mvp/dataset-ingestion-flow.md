# Data flow: model → dataset → ingestion → stitching

> **Superseded in part by [RFC-021](rfc-021-model-authoring.md).** The model is now **authored first
> in the Modeller**, not derived from a dataset's `model.json`. This document is updated to that
> model-first flow; the validate → ingest → stitch steps are unchanged.

How data enters Invana. The user **authors a `GraphModel` in the Modeller** (node/edge/property types,
draft → Publish). Then they **import a dataset** that binds to that model (`dataset.model_id`); one
import job validates the records against the model, ingests them into the one bound graph DB, and
**stitches** them into the rest of the graph. **Many datasets can bind to one model.**

This inverts the earlier "dataset creates the model" flow: the model exists independently and is the
contract; importing checks data against it and records what it checked against.

## The flow

```
GraphModel (authored in Modeller, Published)
        │  bound via dataset.model_id  (many datasets → one model)
        ▼
Dataset                              ┌─────────────── import job (one pipeline) ───────────────┐
─────────────────────                │                                                          │
nodes/<Type>.json   (records)        │   1. validate records against the bound model            │
edges/<Type>.json   (records)        │   2. ingest → write nodes/edges into the ONE bound graph DB│
model.json   (optional, validation)  │   3. stitch → weave the new data into the rest of the graph│
                                     │   4. export model.json snapshot of the version used        │
                                     └──────────────────────────────────────────────────────────┘
```

## Principles (RFC-021)

- **A `GraphModel` is authored in the Modeller** — its node/edge types + properties are hand-defined
  on a draft, then **Published** to an immutable version. The model is the contract data is checked
  against, not a by-product of import.
- **A dataset binds to an existing model** via `dataset.model_id`; **many datasets → one model**.
- **Import validates against the bound model**; the dataset's `model.json` (if present) is used for
  validation, not to create the model. After every import the system **auto-exports a `model.json`
  snapshot** of the version used, stored with the job (trust / provenance).
- **Stitching is a step *inside* the import job**, not a separate manual action.
- **One bound graph DB per Graph.** Every dataset ingests into it; stitching weaves all datasets/models
  into one connected graph. Models are coexisting, connectable **subgraphs** of that one graph — not
  separate databases (see RFC-019 § Vocabulary).

## The import job, step by step

1. **Register** — upload the dataset (`nodes/<Type>.json` + `edges/<Type>.json`, optionally `model.json`
   for validation) to object storage (MinIO); create `Dataset(model_id=…)` + `ImportJob` rows.
2. **Validate** — check every record against the dataset's **bound, authored** model's active version
   (`modeller/validator.py`); produce a structured validation report. Bad records → reported, job fails
   or partials per policy. (No model is created here — the model is authored in the Modeller, RFC-021.)
3. **Ingest** — write the validated nodes/edges into the bound graph DB via the pluggable executor
   (MVP = LocalExecutor), stamping provenance (`_inv_dataset_id`, `_inv_record_id`, `_inv_job_id`).
4. **Stitch** — weave the new data into the rest of the graph (see Open questions for the exact
   semantics): resolve identities against entities already present, and/or link to other models' types.
5. **Snapshot** — export a `model.json` of the model version validated against, stored with the
   `ImportJob` so the user can verify exactly what their data was checked against (trust / provenance).
6. **Result** — the materialized subgraph in the graph DB and full provenance from each node/edge back
   to its source dataset + record + job. The bound `GraphModel` is unchanged (it was authored, not
   created here).

## How it maps to the existing design

| Concept | Where it lives |
|---|---|
| The model a dataset binds to | `GraphModel` / `graph_versions` (RFC-019), authored in the Modeller (RFC-021) |
| Dataset format, object storage, `ImportJob`, executor, validation | `mvp.md` **Layer 3 — Ingestion** |
| Stitching (step 4) | `mvp.md` **Layer 4 — Stitcher**, now folded *into* the import job |
| Record-vs-model validation | `modeller/validator.py` (already exists) |
| Model authoring + viewer | Studio Modeller (`ModellerPage`, full `/models` CRUD — RFC-021) |

## Open questions (resolve before building)

1. **Dataset ↔ model cardinality + model source.** Resolved (RFC-021): the model is **authored in the
   Modeller**, a dataset **binds to it** via `dataset.model_id`, and **many datasets → one model**. The
   dataset's `model.json` is used for validation only; the engine never infers/creates the model.
2. **What "stitch to the entire graph" means.** Candidates (one or both): **identity resolution** (a
   record merges into an existing entity by `id`/key match instead of duplicating) and **cross-model
   anchors** (link this dataset's types to other models' types — "same entity, different perspective").
   And: **automatic** (rules carried in the dataset/model) vs **configured per import**. Leaning: start
   with deterministic identity resolution by `id`; anchors + fuzzy matching later.
3. **One graph, many datasets.** Confirmed: all datasets ingest into the single bound graph DB and
   stitching weaves them into one connected graph (not isolated per-model stores).
