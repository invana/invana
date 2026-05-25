# RFC-019: Multiple Persona-Scoped Graph Models per Graph

**Status**: Draft
**Author**: Invana Team
**Date**: 2026-05-25
**Related**:
- **RFC-002** (Graph Modeller) — *partially superseded*: its resolved decision "one active schema per connection" is lifted to "one active version per GraphModel, many GraphModels per Graph". The `GraphSchema` entity is renamed `GraphModel` and gains persona + ownership fields.
- **RFC-012** (Mission-centric architecture) — *resurrected, simplified*: its multi-model idea (persona-typed models over one DB) is reintroduced, re-parented from `Mission` to `Graph`, **collapsed into a single entity** (no separate `models` table — the fields live on `GraphModel`), and simplified — RFC-012's per-node `subgraph_label` tag is dropped in favour of type-derived membership.
- **RFC-017** (Graph as the primary container) — the container model this builds on; `GraphModel` hangs off `Graph`.
- **RFC-016** (Pluggable executor) — inter-model stitch jobs run via `LocalExecutor`.
- **RFC-018** (Domain audit events) — model/sync/stitch writes emit events.
- **RFC-003** (Ontology & Semantics, deferred) — *explicitly out of scope*: this RFC adds **structural** multi-model support, not OWL/SHACL/JSON-LD semantics.

---

## Problem

The Modeller today is **single-model**: a `Graph` has one bound `GraphConnection`, which owns exactly one `GraphModel` (formerly `GraphSchema`, via `graph_connections.model_id`, a unique 1:1 FK), which has exactly one *active* `GraphVersion`. That single model describes the entire structure of the bound graph database.

This cannot express how real teams reason about the same data. For a **product knowledge graph**, the same underlying product is modelled differently by each role:

- **Architect** → `Service`, `Component`, `Layer`, `DependsOn`
- **Developer** → `Module`, `Class`, `Endpoint`, `Calls`
- **Tester** → `TestSuite`, `Case`, `Bug`, `Regression`, `Covers`
- **Business analyst** → `UserFlow`, `Step`, `Requirement`

These are not the same types renamed. A tester's `Bug` is **data that does not exist** in the architecture model — you cannot derive it by filtering an architecture graph. Each persona's model contributes its **own node/edge types and its own records**, and they overlap only on shared real-world entities (the product, a service, a feature). There is today no way to hold more than one model per Graph, and no way to bind one model's `Component` to another model's `Service` so that they describe the same thing.

RFC-012 designed multi-model support (a `models` table tagging nodes with a `subgraph_label`). RFC-017 removed it when it collapsed `Mission` into `Graph` to ship an MVP. **This RFC reintroduces it, re-parented onto `Graph` — and, unlike RFC-012, as a single entity:** a persona's model *is* a `GraphModel`, not a wrapper around one.

---

## Vocabulary: persona, model, perspective

Three words that are easy to conflate; this RFC fixes their meanings so the design (and future work) stays legible.

- **Persona** — a **role**: architect, developer, tester, business analyst, … A `GraphModel` is *from* a persona; persona is the **organizing dimension** for the models on a Graph. In this RFC persona is a categorization **enum** on `GraphModel` (`architecture | code | test | business | domain | custom`). A richer first-class `Persona` *actor* (bundling skills + instructions + LLM + the models it adopts, and spawning Agents) is anticipated **later, in the agent layer (L6)** — not built here.
- **Model** = **`GraphModel`** — a persona's model of the data: node/edge types, properties, constraints, indexes, with version history. This is the entity this RFC multiplies. "The architecture model," "the test model" are each one `GraphModel` row. It is the *definition* (design-time, in Postgres) — **not** a standalone database.
- **Subgraph** — the **data footprint** a model scopes in the one shared graph DB: the nodes/edges whose types belong to that model (membership is type-derived; not stored separately). So `GraphModel` names the *definition*; "subgraph" names its *runtime data slice* — same perspective, design-time vs runtime. Models are **not** standalone DBs; they are connectable portions of one graph. (We keep the entity name `GraphModel` because the Modeller authors a *model/schema*, not data; "subgraph" stays a conceptual/UX term.)
- **Coexistence** — **all of a Graph's models are live at once** and overlap/connect (via anchors). "Active" is *per-version* (one active `GraphVersion` per model); there is **no** single "active model." `is_default` is only the introspect baseline + the model the Modeller opens first — never exclusivity.
- **Perspective** — **deferred, not built in this RFC.** A *finer-grained, sub-persona* notion: two people who share a persona can still hold the data **differently**, so perspectives are **many-per-persona** (not 1:1 with persona, and below it). The word is **reserved** for that future concept; this RFC does **not** call a `GraphModel` a "perspective".

```
Persona (architect)                 ← role; the organizing dimension (enum, now)
   └─ GraphModel(s) ("Architecture")  ← the persona's model of the data (this RFC)
        └─ (LATER) Perspective(s)      ← sub-persona, per-individual; many per persona; deferred
```

---

## Goals

1. A `Graph` can hold **many `GraphModel`s** — organized **by persona** — each with its **own** node/edge types, constraints, indexes, and version history.
2. Lift RFC-002's single-active-schema constraint to **one active `GraphVersion` per `GraphModel`** (so N active models per Graph).
3. All models live in **one physical graph DB** (RFC-017 keeps `Graph ↔ GraphConnection` 1:1). A node/edge's model membership is derived from its type — no per-node tag.
4. Models are authored both ways: **YAML files** (git-versionable source) **and** the Studio editor, kept in sync through the existing versioner (RFC-002).
5. **Inter-model stitching** binds a type in one model to a type in another as the *same real-world entity*, building the shared "spine" that lets a Graph's models organise the same data.
6. **Datasets are unchanged** (L3): a dataset stays standalone with its own `model.json` and is bound to one *or more* models **at stitch time** (intra-model materialization), not at import time.
7. A persona-`Agent` (§2.7) can be scoped to a `GraphModel` — it reasons within that model's subgraph + skills + LLM.
8. The existing single model migrates cleanly: it becomes the Graph's `is_default` `GraphModel`.

## Non-goals

- **Not** a semantic ontology layer (namespaces, URIs, inverse/transitive/symmetric relations, OWL/SHACL/JSON-LD). That stays RFC-003, deferred.
- **Not** multiple physical connections. `Graph ↔ GraphConnection` stays 1:1 (RFC-017). All of a Graph's models share one DB.
- **Not** read-time-only views. Models own data, so they are materialized modules, not saved queries. (Read-time projection falls out for free — the subgraph induced by a model's labels — but it is not the storage model.)
- **Not** the finer-grained **`Perspective`** concept. Models are **persona-scoped**; "perspective" (a sub-persona, per-individual view, many-per-persona) is reserved and deferred — see § Vocabulary.
- **Not** a first-class **`Persona`** entity. Persona is an enum here; the `Persona` *actor* belongs to the agent layer (L6).
- **Not** changing the L3 dataset/import format or pipeline.

---

## Decision summary

- **A persona's model is one `GraphModel`.** The `GraphModel` entity (the renamed `GraphSchema`) gains the fields directly: `graph_id`, `persona`, `status`, `is_default`, `yaml_path`. **No `models_registry` / wrapper table** — "Model" and "GraphModel" are the same thing.
- **`persona` is an enum on `GraphModel`** (`architecture | code | test | business | domain | custom`), a categorization with a `custom` escape hatch. A first-class `Persona` actor + the `Perspective` sub-concept are deferred (§ Vocabulary).
- **Ownership moves to the Graph, not the connection.** `GraphModel` gains `graph_id` (FK `graphs.id`, CASCADE). A Graph has **many** `GraphModel`s (1:N). Models are anchored on the Graph — not on `GraphConnection` — so they **survive a connection delete or re-point** (the connection is a replaceable pipe to the physical DB; the models are the authored work product) and only cascade when the **Graph** itself is deleted. The legacy `graph_connections.model_id` 1:1 pointer is deprecated — the default model is found by `graph_id + is_default`. (Since `Graph ↔ GraphConnection` is 1:1, this is still "one physical DB ↔ many models" in practice.)
- **Multi-active-version**: each `GraphModel` has its own active `GraphVersion`. The `Projector` iterates a Graph's models and composes their DDL onto the one bound DB. The `GraphVersion` shape is unchanged — the "one active per model" rule already holds per `GraphModel.id`; we just allow N models per graph.
- **Membership is type-derived**: a node/edge carries only its **type label**; its model is whichever active model declares that type — no per-node tag. A shared type name ⇒ a shared node. A reserved `_inv_*` namespace carries provenance + the `:_INV_SAME_AS` anchor edge.
- **YAML ↔ Postgres**: `*.model.yaml` files (reusing the L3 `model.json` property-constraint vocabulary + model metadata) sync into Postgres via the existing `json_io` + `versioner`. **Import creates a new draft `GraphVersion`; activation is explicit.** Studio edits write Postgres; export round-trips to YAML.
- **Inter-model stitching**: new `AnchorMapping` declares `modelA.TypeX ≡ modelB.TypeY` with an identity-resolution rule. **Default `link_mode = link`** (create equivalence edges, preserve model-local nodes + provenance); `merge` is opt-in. Runs as a stitch job via `LocalExecutor` (RFC-016).
- **Agent (§2.7)** gains a nullable `graph_model_id`; retrieval is scoped to that model's label when set.
- **Audit (RFC-018)**: emit `model.create/update/delete/activate`, `model.sync`, `anchor.create/...`, `stitch.run`.
- **New dependency**: a YAML parser (`pyyaml`) in the engine `pyproject.toml`. No other runtime deps.

---

## Schema

All IDs are `String(36)` UUIDs, matching existing modeller + graphs tables.

### `graph_models` — the renamed `graph_schemas`, now persona-scoped + graph-owned

Existing columns (`id`, `name`, `description`, `validation_mode`, `created_at`, `updated_at`) plus the **new fields**:

```
graph_models   (was graph_schemas)
─────────────────────────────────────────────────────────────────────────
id              String(36)   PK
graph_id        FK graphs.id ON DELETE CASCADE        NOT NULL   ← NEW
                — a model is owned by the Graph (RFC-017 container);
                  hard-delete cascades downward with the Graph.
name            String(255)  NOT NULL                 — "Architecture", "Test", ...
description     Text         NOT NULL DEFAULT ''
persona         Enum         architecture | code | test | business | domain | custom   ← NEW
                                                       default 'custom'
                — the role this model is FROM. Categorization enum (see § Vocabulary).
validation_mode Enum         strict | permissive      (existing)
status          Enum         draft | active | archived   default 'draft'   ← NEW
                — the MODEL lifecycle (distinct from GraphVersion.status,
                  which is the per-version draft/active/archived state).
is_default      Boolean      NOT NULL DEFAULT false   ← NEW
                — exactly one default model per graph (migration target for
                  the pre-RFC-019 single schema).
yaml_path       String(1024) nullable                 ← NEW
                — relative path of the *.model.yaml when the model is
                  YAML-managed. NULL = authored in Studio. (Single indicator
                  of YAML ownership — no separate `source` field.)
created_at      DateTime(tz)
updated_at      DateTime(tz)

UNIQUE (graph_id, name)
PARTIAL UNIQUE (graph_id) WHERE is_default        — mirrors llm_providers.is_default
```

`GraphVersion` and all definition tables (`node_type_definitions`, `edge_type_definitions`, `property_key_definitions`, `type_property_mappings`, `validation_rules`, `constraint_definitions`, `index_definitions`, `schema_projections`) are **unchanged** — they already hang off a `GraphModel` (`model_id` FK → `graph_models.id`) and version per model. The only product-rule change is **N models per graph** (each with its own active version) instead of one.

### `anchor_mappings` — inter-model spine (NEW)

```
anchor_mappings
─────────────────────────────────────────────────────────────────────────
id                String(36)  PK
graph_id          FK graphs.id ON DELETE CASCADE       NOT NULL
source_model_id   FK graph_models.id ON DELETE CASCADE — the source GraphModel
source_type       String(255)  — node-type name in the source model
target_model_id   FK graph_models.id ON DELETE CASCADE
target_type       String(255)
resolution        JSON  NOT NULL
                  — { "strategy": "deterministic" | "property_match" | "fuzzy",
                      "keys": ["name", ...],
                      "case_insensitive": bool,          (property_match)
                      "threshold": 0.0-1.0 }             (fuzzy)
link_mode         Enum  link | merge   default 'link'
                  — link: create :_INV_SAME_AS equivalence edge, keep both nodes.
                  — merge: fold the two nodes into one.
status            Enum  draft | active | archived   default 'draft'
created_at        DateTime(tz)
updated_at        DateTime(tz)
```

### Migration of the legacy binding

Today: `graph_connections.model_id` (unique, `ON DELETE SET NULL`) points at the single `GraphModel`, which has no `graph_id`.

Migration `00000000000f` (autogenerated + data step):
1. Add the new columns to `graph_models`; create `anchor_mappings`.
2. For every `graph_connections` row with a non-null `model_id`, backfill the referenced `GraphModel`: set `graph_id = connection.graph_id`, `name='Default'` (keep existing name if present and non-generic), `persona='domain'`, `status='active'`, `is_default=true` (leave `yaml_path` NULL — Studio-managed). Make `graph_id` NOT NULL after backfill.
3. Leave `graph_connections.model_id` in place for one release as a **read-only legacy pointer** (no new writes); a follow-up migration drops it once all reads route through `graph_models.graph_id`. (Tracked alongside the existing "tighten `graph_connections.graph_id` to NOT NULL" cleanup.)

---

## Physical representation — how a Graph's models coexist in one DB

One bound graph DB holds the union of all of a Graph's models. **There is no per-node model tag.** A node/edge carries only its **type label** (`:Service`, `:Bug`); its **model membership is derived** — it belongs to whichever active model's schema declares that type:

- **Disjoint type sets → disjoint models.** A `:Bug` node belongs to the test model, a `:Service` node to the architecture model, with nothing stamped on the node.
- **A shared type name → a shared node.** If two models both declare `Service`, a `:Service` node belongs to *both* — that overlap is the natural spine, no extra bookkeeping.

This is why `subgraph_label` was dropped: with type-derived membership it has no job to do.

**Reserved namespace.** A `_inv_` prefix is reserved on properties/edge-types for engine bookkeeping so it can never collide with user types:
- `_inv_dataset_id`, `_inv_record_id`, `_inv_stitch_job_id` — provenance stamped at materialization (L4.5).
- `:_INV_SAME_AS` — the inter-model equivalence edge type (used by `link`-mode anchors to bind two *differently-named* types that denote the same entity, e.g. `Component` ≡ `Service`).

A **read-time view of a single model** is then the subgraph induced by `{nodes whose type is declared by model M} ∪ {anchors reachable via :_INV_SAME_AS}` — derived from the schema, no stored membership.

**Cross-backend parity.** Type label = node label on Cypher backends, vertex label on Gremlin. Since membership is the type itself (not an extra label), there's nothing special to represent per backend — both already have a single type label per node/vertex. The projector/connector capability gating (RFC-002 §projection) is unchanged.

---

## Multi-model in the Modeller

- `SchemaStore` (`store.py`) currently does `list_schemas()` with no graph filter (binding was via the connection pointer). It gains `list_models(graph_id)` and resolves each model's active `GraphVersion` via the existing `get_active_version(model_id)`.
- Creating a `GraphModel` with zero type definitions is allowed (a `draft` model sketched before its types are authored).
- **Projector composition** (`projector.py`): instead of projecting one model, iterate the graph's `active` models, project each model's active version against the one bound connector, and record one `SchemaProjection` per `(version, connector)` as today. Because Cypher DDL is **per-label**, `:Service` (arch) constraints and `:Bug` (test) constraints coexist with no clash.
  - **Label collision policy** (two models both declare `Service`): default is **shared** — the type label is one physical label and both models' constraints apply to it (they must be compatible; incompatible constraint = projection error recorded in `SchemaProjection.errors`, not a silent overwrite). Per-model physical namespacing (`arch__Service`) is rejected because it would defeat anchors. (See Open questions.)
- **Validator** (`validator.py`): validates a record against the **target model's** active version (used by intra-model stitch). Unchanged logic, parameterized by `graph_model.id`.
- **Reconciler / introspector**: introspection produces / refreshes the `is_default` model (the as-built baseline). Authored persona models are layered on top.

---

## YAML ↔ Postgres sync

Reuses the L3 `model.json` property-constraint vocabulary (`string`/`integer`/`float`/`boolean`/`enum`/`datetime`/`uuid`/`json` with `required`/`min`/`max`/`min_length`/`max_length`/`pattern`/`enum.values`) so authors learn one schema language across datasets and models.

### Directory convention

```
<models-dir>/
├── architecture.model.yaml
├── code.model.yaml
├── test.model.yaml
└── stitch/
    └── anchors.yaml
```

### `*.model.yaml`

```yaml
name: Architecture
persona: architecture
description: The architect's model of the product.
validation_mode: strict
nodes:
  Service:
    description: A deployable service.
    properties:
      name:  { type: string, required: true, max_length: 255 }
      tier:  { type: enum, values: [edge, core, data] }
    constraints:
      - { type: unique, properties: [name] }
    indexes:
      - { type: range, properties: [tier] }
  Component:
    properties:
      name: { type: string, required: true }
edges:
  DependsOn:
    from: [Service]
    to:   [Service]
    multiplicity: MULTI
    properties:
      kind: { type: enum, values: [sync, async] }
```

### `stitch/anchors.yaml`

```yaml
anchors:
  - source: { model: architecture, type: Component }
    target: { model: code,         type: Service }
    resolution: { strategy: property_match, keys: [name], case_insensitive: true }
    link_mode: link
```

### Sync semantics

- `invana models sync --graph <u/slug> --path <dir>` parses each `*.model.yaml`:
  - Upsert the `graph_models` row by `(graph_id, name)`; set `yaml_path`, `persona`.
  - Build a schema definition via the existing `json_io` importer and create a **new draft `GraphVersion`** under that `GraphModel`.
  - **Activation is explicit** — sync never auto-activates; the user activates from CLI (`--activate`) or Studio. Preserves an audit trail; avoids clobbering a live model mid-edit.
- `anchors.yaml` upserts `anchor_mappings`.
- Export: `invana models export --graph <u/slug> --path <dir>` writes the active version of each model back to YAML (round-trip).
- **Conflict / drift**: because YAML import always lands as a new draft version, YAML and Studio never silently overwrite each other — both produce versions; the active one is whatever was last activated. Drift (active version vs YAML on disk) is surfaced as a Studio banner. (See Open questions for a stronger policy.)

---

## Stitcher — intra-model and inter-model

The stitcher itself (MVP L4.2–4.5 / slice S7) is greenfield; this RFC fixes the two contracts it must satisfy.

1. **Intra-model materialization** (retargets the planned `StitchMapping`): a `StitchMapping`'s target is a **`GraphModel`** (its `graph_model_id` + a type in that model), not "the graph's single user model". Materialization writes nodes/edges into the bound DB stamped with provenance (`_inv_dataset_id`, `_inv_record_id`, `_inv_stitch_job_id`); model membership follows from the materialized nodes' types. One dataset can be mapped into several models.
2. **Inter-model stitching** (`AnchorMapping`): resolves identity between `source_model.source_type` and `target_model.target_type` using `resolution`, then `link` (default — add `:_INV_SAME_AS`) or `merge` (fold to one node). Runs as a `StitchJob` via `LocalExecutor` (RFC-016) with the same structured-log + SSE pattern as L3 import jobs.

Provenance (L4.5): every materialized node/edge is traceable to dataset + record + job; anchor edges additionally carry `anchor_mapping_id`.

---

## Agents (§2.7) — persona scoping

The planned `Agent` entity gains a nullable `graph_model_id` FK → `graph_models` (`ON DELETE SET NULL`). When set, the agent's grounded retrieval (L6.1/L5) is scoped to that model's subgraph (nodes carrying its label + anchored entities). `null` = whole-graph agent. No other agent work changes; this is one FK + one query predicate. (When the first-class `Persona` actor lands in L6, an Agent will bind a Persona, which in turn adopts model(s) — but that is out of scope here.)

---

## API surface

All graph-scoped, under `/api/v1/u/{username}/{graphSlug}` (RFC-017), guarded by `require_graph_member` (reads) / `require_graph_builder` or `require_graph_admin` (writes), and `require_graph_setup_complete` where DB access is involved. A "model" in these routes is a `GraphModel`.

```
GET    /models                         list the graph's GraphModels (+ active-version summary)
POST   /models                         create (admin/builder)
GET    /models/{model_id}              detail (types + active version + counts)
PATCH  /models/{model_id}              rename / description / persona / status
DELETE /models/{model_id}              hard delete (cascades versions + definitions)
POST   /models/{model_id}/activate     activate the model's draft version (+ project DDL)
POST   /models/{model_id}/set-default  flip is_default (clears the previous default)

# type/version editing — existing modeller routes, now keyed by model_id
GET    /models/{model_id}/active-version
POST   /models/{model_id}/...          (node/edge/property/constraint/index CRUD)

# inter-model anchors
GET    /models/anchors                 list
POST   /models/anchors                 create
DELETE /models/anchors/{id}
POST   /models/anchors/{id}/stitch     run an inter-model stitch job (returns StitchJob handle)

# sync (also available via CLI)
POST   /models/sync                    body: parsed YAML bundle → draft versions
```

`/connection/introspect` keeps producing/refreshing the `is_default` model's baseline.

---

## Studio surface

- **Modeller page** (`ModellerPage`) gains a **model switcher** (the existing left `TabbedPanel` per the studio convention) — pick a model (typically grouped by persona); the `SchemaCanvas` renders that model's types. "New model" + per-model type editing reuse the existing modeller components, now keyed by `model_id`.
- **Model list / create** within the Modeller shell: name, persona, optional starting point (blank / introspected / from YAML).
- **Anchors editor**: two-column view (source model types ↔ target model types), drag-to-map, resolution-rule form, `link`/`merge` toggle, "Run stitch" with the L3-style live log panel.
- **Drift banner**: when a model has a `yaml_path` and the on-disk YAML differs from the active version.
- Design-kit components only; `@invana/canvas` for the per-model schema diagram (CLAUDE.md #9/#10).

---

## CLI

```
invana models sync   --graph <username/slug> --path <dir> [--activate]
invana models export --graph <username/slug> --path <dir>
invana models list   --graph <username/slug>
```

---

## Audit events (RFC-018)

Emit via `emit_event`: `model.create`, `model.update`, `model.delete`, `model.activate`, `model.set_default`, `model.sync`, `anchor.create`, `anchor.delete`, `anchor.stitch` (system actor for the job), reusing the changed-keys-diff convention and `_encrypted`/sensitive omission rules.

---

## Migration / sequencing

Greenfield + RFC-gated. Build order after this RFC is accepted (each its own slice, demoable from a clean checkout):

1. Expand `graph_models` (persona + ownership fields) + `anchor_mappings`, migration `00000000000f`, backfill the `is_default` model, update the starlette-admin `GraphModelView` (engine CLAUDE.md rule), add `pyyaml`.
2. `SchemaStore.list_models(graph_id)` + multi-active-version reads; route the existing modeller type/version routes through `model_id`.
3. `Projector` composition across active models; `_inv_*` label/property convention in the connector write path.
4. YAML loader (`json_io` reuse) + `invana models sync/export` + versioner draft/activate.
5. Studio: model switcher + per-model type editor; model list/create.
6. Stitcher S7: intra-model materialization targeting a `GraphModel`; then `AnchorMapping` + inter-model stitch (link).
7. Agent `graph_model_id` binding (with §2.7).

## Scope impact on `mvp.md` (companion edit)

- **§4.1** — "single user graph model" → "multiple `GraphModel`s (persona-scoped) per Graph; one active version per model".
- **§4.2** — `StitchMapping` target is a **`GraphModel`**.
- **NEW §4.6** — inter-model stitching (`AnchorMapping` / shared spine).
- **§2.7 Agent** — add nullable `graph_model_id` model binding.
- **L3** — note: unchanged (standalone dataset, bind at stitch — confirmed by this RFC).
- **Deferred list** — clarify this adds **structural, persona-scoped** multi-model support; the first-class `Persona` actor and the sub-persona `Perspective` concept are deferred (§ Vocabulary), and RFC-003 semantic ontology stays deferred. Note RFC-002's "one active schema per connection" is superseded here, and `GraphSchema` is renamed `GraphModel`.

---

## Open questions

1. **`link` vs `merge` default for anchors.** Proposed: `link` (preserves model-local nodes + provenance; `merge` opt-in per mapping). Confirm.
2. **Shared type names across models.** With type-derived membership, a type name shared by two models is *one* physical label belonging to both, and both models' constraints apply to it (must be compatible; incompatible → projection error). This is intended — it forms the shared spine — not a conflict to resolve. Confirm we want shared names to mean shared nodes (vs. requiring globally-unique type names per Graph).
3. **YAML vs Studio conflict policy** beyond "import = new draft". Hard drift-locking (YAML-managed models read-only in Studio) or advisory banners only?
4. **Drop timing for `graph_connections.model_id`.** Kept one release as a legacy pointer; confirm the follow-up migration that drops it.
5. **Per-model `validation_mode` on a shared-name type.** When a type is declared by two models, which model's mode governs a write that touches it? Likely the model the write is scoped to; spell out in the stitcher slice.
6. **Future `Persona` actor + `Perspective` concept (L6).** When personas become first-class (adopting models + carrying skills/LLM/agents) and perspectives subdivide a persona per-individual — how do they relate to `GraphModel` and `graph_model_id`? Out of scope here; flagged so the enum/FK choices don't paint us into a corner.
```

