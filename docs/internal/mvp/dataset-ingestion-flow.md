# Data flow: dataset → model → ingestion → stitching

How data enters Invana. **Importing a dataset is the single entry point**: it *creates* a
`GraphModel` from the dataset's `model.json`, ingests the records into the one bound graph DB, and
**stitches** them into the rest of the graph — all inside one import job. The Modeller is a
**read-only viewer** of the resulting models; users never hand-author models or publish versions.

This refines the earlier L3/L4 split ("standalone dataset, bind at stitch later"): model creation,
versioning, and stitching now happen **together, in the import pipeline**.

## The flow

```
Dataset                              ┌─────────────── import job (one pipeline) ───────────────┐
─────────────────────                │                                                          │
model.json   (types + constraints) ──┼─▶ 1. derive/version GraphModel  (re-import ⇒ new version, │
nodes/<Type>.json   (records)        │      from model.json               auto-active)           │
edges/<Type>.json   (records)        │   2. validate records against that model                  │
                                     │   3. ingest → write nodes/edges into the ONE bound graph DB│
                                     │   4. stitch → weave the new data into the rest of the graph│
                                     └──────────────────────────────────────────────────────────┘
                                                  │
                Modeller (read-only) ◀────────────┘  shows the resulting GraphModel + its schema
```

## Principles (confirmed)

- **A `GraphModel` is the by-product of importing a dataset.** Its node/edge types + constraints come
  from the dataset's `model.json` — not hand-authored in the Modeller.
- **Re-importing a dataset creates a new *version* of its model**, activated automatically. There is no
  manual draft/edit/publish step — that's why those controls were removed from the Modeller.
- **The Modeller is read-only** — list models, view each model's active schema. No create/edit/publish.
- **Stitching is a step *inside* the import job**, not a separate manual action.
- **One bound graph DB per Graph.** Every dataset ingests into it; stitching weaves all datasets/models
  into one connected graph. Models are coexisting, connectable **subgraphs** of that one graph — not
  separate databases (see RFC-019 § Vocabulary).

## The import job, step by step

1. **Register** — upload the dataset (`model.json` + `nodes/<Type>.json` + `edges/<Type>.json`, the L3
   on-disk format) to object storage (MinIO), create `Dataset` + `ImportJob` rows.
2. **Derive/version the model** — parse `model.json` → create the `GraphModel` (first import) or a new
   `GraphVersion` of it (re-import); activate it. (Reuses the modeller store + versioner.)
3. **Validate** — check every record against the model (`modeller/validator.py`); produce a structured
   validation report. Bad records → reported, job fails or partials per policy.
4. **Ingest** — write the validated nodes/edges into the bound graph DB via the pluggable executor
   (MVP = LocalExecutor), stamping provenance (`_inv_dataset_id`, `_inv_record_id`, `_inv_job_id`).
5. **Stitch** — weave the new data into the rest of the graph (see Open questions for the exact
   semantics): resolve identities against entities already present, and/or link to other models' types.
6. **Result** — a `GraphModel` (read-only in the Modeller), its materialized subgraph in the graph DB,
   and full provenance from each node/edge back to its source dataset + record + job.

## How it maps to the existing design

| Concept | Where it lives |
|---|---|
| The model the import creates/versions | `GraphModel` / `graph_versions` (RFC-019) |
| Dataset format, object storage, `ImportJob`, executor, validation | `mvp.md` **Layer 3 — Ingestion** |
| Stitching (step 5) | `mvp.md` **Layer 4 — Stitcher**, now folded *into* the import job |
| Record-vs-model validation | `modeller/validator.py` (already exists) |
| Read-only model viewer | Studio Modeller (`ModellerPage`, `/models` GET routes) |

## Open questions (resolve before building)

1. **Dataset ↔ model cardinality + model source.** Assumed: **one dataset → one model**, re-import = a
   new version; the dataset **arrives with** its `model.json` (authored by the user's pipeline, per L3 —
   not inferred from records). Confirm.
2. **What "stitch to the entire graph" means.** Candidates (one or both): **identity resolution** (a
   record merges into an existing entity by `id`/key match instead of duplicating) and **cross-model
   anchors** (link this dataset's types to other models' types — "same entity, different perspective").
   And: **automatic** (rules carried in the dataset/model) vs **configured per import**. Leaning: start
   with deterministic identity resolution by `id`; anchors + fuzzy matching later.
3. **One graph, many datasets.** Confirmed: all datasets ingest into the single bound graph DB and
   stitching weaves them into one connected graph (not isolated per-model stores).
