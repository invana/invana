# RFC-021: Model-first authoring (Modeller becomes editable)

**Status**: Draft
**Author**: Invana Team
**Date**: 2026-05-28
**Related**:
- **RFC-019** (Multiple persona-scoped GraphModels per Graph) — the entity model this builds on
  (`GraphModel` / `GraphVersion` / node-edge-property type tree). RFC-019's "read-only viewer + model
  switcher" surface is **extended** here into a full authoring surface.
- **RFC-020** (Dataset ingestion) — **partially superseded**: its locked decision #2 ("a `GraphModel`
  is the by-product of importing a dataset; the engine derives the model from the dataset's
  `model.json`") is inverted (see *Dataset relationship* below). The validate + ingest + stitch steps
  stand.
- **RFC-002** (Graph Modeller) — the underlying store/versioner/validator machinery, reused as-is.
- **RFC-018** (Domain audit events) — model/version writes emit events (already wired).

## Problem / intent

The Modeller currently only *views* models. Models were assumed to arrive from a dataset's
`model.json` ([`dataset-ingestion-flow.md`](dataset-ingestion-flow.md), RFC-020). In practice users
need to **define the model first** — the node types, edge types, and property types their data must
conform to — and then point one or more datasets at it. This RFC makes the Modeller a first-class
authoring tool and inverts the dataset↔model relationship.

The backend already implements the full authoring API (create model, draft version, create/update/
delete node & edge types, create/delete property keys, activate) with draft-only enforcement; this is
mostly **a Studio authoring surface** plus two small backend gaps (below).

## Decisions

1. **Models are authored in the Modeller.** A `GraphModel` is created and edited by hand: add node
   types, edge types, and properties via forms in the existing nav + detail panels. The canvas stays
   read-only this slice.

2. **Explicit draft → Publish lifecycle, surfaced in Studio.** Editing happens on a **draft**
   `GraphVersion`. The user clicks **Publish** (the existing `activate` endpoint, relabeled) to cut an
   immutable version. A published version cannot be edited; to change it, create a new draft (cloned
   from the active version). Only one draft per model at a time (already enforced by `create_version`).
   Draft-only mutation is enforced server-side (409 `version_not_draft`); the Studio gate is UX only.

3. **Editable this slice:** Models (create/edit/delete), Node types, Edge types, and
   Property keys — **including editing a property key's type**. Constraints and Indexes remain
   read-only for now (authoring UI deferred).

4. **The `global` model — read-only, system-managed.** Every Graph has a system model named
   **`global`** (`origin = "introspected"`) that mirrors the **physical** database schema. It is
   **generated only by introspection** (`POST …/connection/introspect`, auto-run on first connect) —
   never hand-authored — and re-introspecting is **idempotent** (reuses the same model, adds a new
   active version; no duplicate models). `GraphModel` gains an `origin` column
   (`studio | yaml | introspected`); the create-draft route rejects drafts on an `introspected` model
   (409 `model_read_only`), so the type-authoring endpoints are transitively blocked. In Studio the
   `global` model shows a read-only "system" view with a **Refresh from DB** (introspect) action and no
   create/edit/delete affordances. Authored models layer on top of it.

   `GraphModel` carries **no `persona` and no `is_default`** — models are distinguished only by
   name + `origin`; there is no "default model" concept (the `global` model is identified by
   `origin = "introspected"`, not a default flag).

5. **Dataset relationship is inverted.** A dataset binds to an **already-authored** model via
   `dataset.model_id`, and **many datasets may bind to one model**. On import:
   - the dataset's `model.json` (if present) is used to **validate** the records against the bound
     authored model — it no longer *creates* the model; and
   - after every import job the system **auto-exports a `model.json` snapshot** of the version actually
     used, stored alongside the job, so the user can verify exactly what the data was checked against
     (trust / provenance — no hidden engine state).
   *(This dataset-side rework is documented here but implemented as a follow-up — see Scope.)*

## Backend gaps filled by this slice

The authoring API was complete except for two operations the authoring UX needs:

1. **Edit a property key** — `PATCH …/property-keys/{key_id}` + `ModelStore.update_property_key`
   (rename / change type / cardinality; rename guarded against the per-version unique name). Property
   keys are **global per version**, so editing one changes it for every type that uses it in that
   draft.
2. **Edit a type's properties after creation** — `NodeTypeUpdate` / `EdgeTypeUpdate` gain an optional
   `property_mappings` list; `update_node_type` / `update_edge_type` **full-replace** the mappings when
   it is provided (`[]` clears all, absent leaves them untouched). The Studio sends the type's complete
   property list on each change. A property on a type = a `TypePropertyMapping` referencing a global
   property key; adding a property creates the key (if new) then re-sends the list.

## Studio surface

- **Model list** (`ModelListPanel`): "+ New model", Introspect (↻, regenerates `global`), per-row
  rename / delete (the `global` model has no row actions).
- **Version state** (`ModellerPage`): drives off the versions list — shows the draft if one exists
  (editable), else the published version (read-only). Header shows **Create draft** (when published)
  or **Publish** + **Introspect** (when a draft is open). A `draft` / `v{n}` badge marks the state.
- **Type authoring**: ＋ buttons on the Node/Edge Types nav sections; selecting a type opens its detail
  on the right, where properties are added / edited / removed and the type metadata is edited or the
  type deleted. Forms reuse `@invana/design-kit` Dialog/Select/Input.
- All edit affordances are gated on `version.status === "draft"`.

## Scope

**In this slice:** the backend gaps above; the Studio authoring surface for models + node/edge/property
types; docs reconciliation (this RFC + `dataset-ingestion-flow.md` + `mvp.md` §4.1/S3).

**Follow-up (not built here):**
- Dataset-import inversion: validate records against the bound authored model (don't create the model
  from `model.json`); auto-export a `model.json` snapshot per `ImportJob`; surface model-binding
  (`dataset.model_id`, many datasets → one model) in the dataset UI/CLI.
- Constraints & Indexes authoring UI.
- Interactive canvas editing (draw types on the `SchemaCanvas`).
- YAML round-trip of hand-authored models (RFC-019 `*.model.yaml`).

## Verification

Author end-to-end in Studio: New model → (initial draft) → add node types → add an edge type linking
them → add/edit/remove properties → edit a property key's type and confirm it changes everywhere it's
used → **Publish** → confirm the version is read-only → **Create draft** to edit again. Backend: the
new `PATCH …/property-keys/{key_id}` and the `property_mappings` field on the type-update schemas appear
in `/docs`; `ModelStore` tests cover property-key edit, mapping full-replace, and the draft-only guard.
