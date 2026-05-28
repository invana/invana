# RFC-020: Dataset ingestion (dataset → model → graph)

**Status**: Draft
**Author**: Invana Team
**Date**: 2026-05-27
**Related**: [`dataset-ingestion-flow.md`](dataset-ingestion-flow.md) (the flow this formalizes) · RFC-019
(`GraphModel`) · `mvp.md` L3 (Ingestion) + L4 (Stitcher) · RFC-016
(pluggable executor) · RFC-018 (audit events) · **RFC-021 (model-first authoring)**.

> **Partially superseded by [RFC-021](rfc-021-model-authoring.md).** The model is now **authored in the
> Modeller**, not created from the dataset's `model.json` (locked decision #2 below is inverted): a
> dataset *binds* to an existing model (`dataset.model_id`, many datasets → one model), and import
> *validates* records against it (and exports a `model.json` snapshot per job). The validate → ingest →
> stitch machinery here is unchanged.

## Problem / intent

Importing a dataset is **the** way data enters Invana. One import job: derive/version a `GraphModel`
from the dataset's `model.json`, validate the records, write them into the bound graph DB, and stitch
them into the rest of the graph. The Modeller only *views* the resulting models (RFC-019). Most of the
machinery already exists — `GraphModel` + `Versioner`, the record `validator`, the connector write
path, and the read-only viewer — so this is mostly **orchestration + a trigger**, not a new layer.

## Locked decisions

1. **Thin BE + CLI first.** Slice 1 is a `datasets/` module + `invana datasets import`, reusing the
   modeller machinery, with **local files** (MinIO deferred) and a **synchronous** run (async
   executor + SSE logs deferred).
2. **Authored `model.json`.** ~~The dataset arrives with its own `model.json`; first import creates the
   `GraphModel`, re-import = a new `GraphVersion`.~~ **Superseded by RFC-021:** the model is authored in
   the Modeller; a dataset *binds* to it (`dataset.model_id`, many datasets → one model) and import
   *validates* against it, exporting a `model.json` snapshot per job. The engine never infers the model
   from records.
3. **Stitch v1 = identity match (id or property keys).** Ingest **upserts** by identity: default
   `(type, id)`; a node type may declare identity property keys in `model.json` (`"identity": ["name"]`)
   to match/merge by those instead. Re-imports upsert; edges connect by their endpoints' identity.
   Cross-model anchors + fuzzy matching are deferred.

## Entities (new `datasets/` module)

```
datasets                                   import_jobs
──────────────────────────────             ─────────────────────────────────────────
id            String(36) PK                id              String(36) PK
graph_id      FK graphs.id CASCADE         dataset_id      FK datasets.id CASCADE
model_id      FK graph_models.id SET NULL  status          queued|running|succeeded|failed|cancelled
name          String(255)                  model_version_id  FK graph_versions.id  (the version it made)
description   Text                         records_total / records_processed  Integer
storage_uri   String   (file:// in v1)     error_count / warning_count         Integer
record_counts JSONB    {nodes:{T:n},...}   report          JSONB  (validation report)
last_job_id   String                       started_at / finished_at            DateTime
created_at / updated_at                    created_at                          DateTime
UNIQUE (graph_id, name)
```

Both get starlette-admin `ModelView`s (engine rule). Hard delete cascades downward
(`Graph → Dataset → ImportJob`).

## On-disk dataset format (authored)

Per `mvp.md` L3 — unchanged:
```
<dataset>/
├── model.json              # node/edge types + per-property constraints  (+ optional "identity": [keys])
├── nodes/<NodeType>.json   # array of { "id": ..., "properties": {...} }
└── edges/<EdgeType>.json   # array of { "id": ..., "from": ..., "to": ..., "properties": {...} }
```

## The import job (synchronous, slice 1)

`invana.datasets.import_dataset(graph, name, path)` → `ImportJob`:

1. **Register** — upsert `Dataset(graph_id, name, storage_uri=file://path)`; create `ImportJob(running)`.
2. **Model** — parse `model.json`; `ModelStore.create_graph_model` (first import) or `create_version`
   (re-import); populate node/edge types, property keys, constraints, indexes from `model.json` (reuse
   `create_node_type` / `create_edge_type` / …); `Versioner.activate`. Record `model_version_id`.
3. **Validate** — every record against the active version (`modeller/validator.py`); collect a
   structured report (`file, record_index, record_id, field, rule, message`). Collect-all (capped).
4. **Ingest + stitch** — for each node: `MERGE` by identity `(type, id)` or the type's `identity` keys,
   set properties, stamp provenance (`_inv_dataset_id`, `_inv_record_id`, `_inv_job_id`); for each edge:
   resolve `from`/`to` by identity and `MERGE` the relationship. Written via the bound connector.
5. **Finish** — update `record_counts`, counts, `report`; `ImportJob → succeeded|failed`; emit
   `dataset.import` event (RFC-018). The model now shows (read-only) in the Modeller; nodes are
   queryable in Explorer.

## CLI

```
invana datasets import --graph <username/slug> --name <name> --path <dir>
```
(Resolves the graph, runs `import_dataset`, prints the job result + validation report.)

## Slice plan

- **S1 (this slice):** `datasets/` entities + migration + admin views; `import_dataset` pipeline
  (model + validate + ingest + id/property stitch); `invana datasets import`; an example dataset.
- **S2:** MinIO storage (`storage_uri = s3://…`); streamed uploads.
- **S3:** async executor (RFC-016 LocalExecutor) + `ImportJob` status/log streaming (SSE).
- **S4:** Studio dataset UI (browser + import + detail tabs: Logs / Files / Model / Records).
- **S5:** richer stitch — cross-model anchors, fuzzy matching.

## Deferred
MinIO; async executor + SSE logs; Studio UI; cross-model anchors; fuzzy identity; model inference from
records; cross-dataset edge references.

## Verification (slice 1)
A folder with `model.json` + `nodes/Service.json` (one row violating a constraint) + `edges/DependsOn.json`,
`invana datasets import --graph admin/demo --name svc --path ./svc/` → an `ImportJob(succeeded)` with the
bad row flagged in the report; the **Service** model appears (read-only) in the Modeller; `Service` nodes
+ `DependsOn` edges are queryable in Explorer; a re-import upserts (no duplicates) and bumps the version.
