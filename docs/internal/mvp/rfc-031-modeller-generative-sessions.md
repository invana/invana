# RFC-031: Modeller generative sessions — prompt → draft model → commit

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-15
**Related**:
- **RFC-030** (LLM translation service) — **hard dependency.** Reuses `invana/llm/` (provider-agnostic
  client + forced tool-use + grounding) and adds a second intent (`propose_model`) alongside
  `submit_query`.
- **RFC-024** (Query Sessions) — sessions are the substrate. This RFC makes them **surface-aware**
  (Explorer | Modeller) and reuses the panel / composer / thread UI; messages stay **metadata-only**
  (no deviation from RFC-024 Decision 3).
- **RFC-029** (Modeller staged commit) — a draft version is the staging area; **Publish is the single
  commit**. Generated types land in a draft; "commit" = the existing activate.
- **RFC-027** (Interactive modeller canvas) — `SchemaCanvas` already renders a draft model's type graph;
  the generated draft previews there for free.

> **Scope note (revised 2026-06-15):** this RFC authors the **model only** (node/edge types + property
> keys). Generating *sample data* and writing it to the graph DB is **out of scope** — that removes the
> dataset-ingestion dependency entirely and keeps every write inside the existing draft→activate path.
> Sample-data generation, if ever wanted, is a separate fast-follow.

---

## Problem / intent

Sessions today only live in the Explorer, and they only *query*. But the same ask/answer loop is the
natural way to **author a model**: *"build a model of people and the projects they work on, with some
generic properties"* — watch the node/edge types appear in the draft on the canvas, **fine-tune** it
(more prompts, or by hand), and **commit** when happy. Today that requires hand-building every node
type, edge type, and property key through the Modeller dialogs.

RFC-030 establishes that a prompt + the graph's ontology yields a *validated structured* artifact. This
RFC points that at the Modeller, and it maps cleanly onto machinery that already exists:

- generation writes the proposed types into a Modeller **draft version** (RFC-029's staging area — it
  survives reload, renders in the type tree, and is reversible by discarding the draft);
- the **existing modeller canvas** (`SchemaCanvas`) renders that draft live — the "preview" is just the
  draft, no special payload;
- **fine-tuning** happens two ways on the same draft: keep prompting to refine, *or* hand-edit via the
  existing draft-only dialogs — they compose;
- **commit** = the existing **Publish/activate** — no new commit machinery, no connector write.

"Create a draft, edit it, commit to save" maps exactly onto draft → activate. The only genuinely new
surface is making sessions surface-aware and adding one generation intent.

---

## Decisions

1. **Sessions become surface-aware.** Add `Session.surface: "explorer" | "modeller"` (default
   `"explorer"` — existing rows and the create path keep working). A session is created with its surface;
   the Modeller page mounts the **same** `SessionsPanel` / `SessionComposer` / `useSessions`,
   parameterized by `surface="modeller"`. Explorer behaviour is untouched.

2. **A modeller session is bound to one model.** Add `Session.model_id` (nullable FK `graph_models.id`,
   `ON DELETE SET NULL`). A modeller session authors exactly one model's **draft**. If the session is
   unbound (a fresh "model this for me" session), the first generation **creates the model + an initial
   draft** and binds the session to it; later turns refine that same draft.

3. **A second translation intent: `propose_model` (model only — no data).** RFC-030's `invana/llm/`
   gains a Modeller intent. The forced tool is `propose_model`, input schema:
   ```
   {
     node_types:    [{ name, description?, property_keys: [{ name, type }] }],
     edge_types:    [{ name, source_node_types: [str], target_node_types: [str],
                      property_keys: [{ name, type }] }],
     summary: str   # human-readable description of what was proposed/changed
   }
   ```
   Grounded (RFC-030 Decision 4) on the session's **current draft** (or active version) so *"add X"*
   refines the existing model rather than starting over; empty when authoring from scratch.

4. **Generation reconciles the proposal into the draft.** The translator applies the proposal to the
   model's draft via the existing `ModelStore` (`create_property_key` / `create_node_type` /
   `create_edge_type`, plus the `update_*` calls for changes), all **draft-only** guarded — the exact
   API the manual dialogs already use. A reconcile diffs the proposal against the current draft: new
   types are created, changed types updated, untouched types left alone. Removal is **conservative** —
   generation never deletes a type the user didn't ask to remove (open question on explicit "remove X").

5. **No new preview path — the draft *is* the preview.** Because generation writes to the draft and
   `SchemaCanvas` already renders the draft's type graph, the proposed model appears on the canvas and in
   the type tree with **zero** new rendering code. The assistant reply carries the `summary` and a
   compact "added: N node types, M edge types, K properties" line — no result payload, no canvas
   special-case.

6. **Fine-tuning is conversational *and* manual, on one draft.** Subsequent prompts re-ground on the
   current draft and emit an updated `propose_model`, mutating the draft. The user can equally open the
   existing node/edge/property dialogs and edit by hand — same draft, same guards. Neither path is
   privileged.

7. **Commit = the existing Publish/activate.** Committing a generative session is the standard Modeller
   publish: `Versioner.activate` the draft (assign SemVer, archive prior active). **No new commit route,
   no dataset, no connector data write.** The session UI surfaces a "Commit" button that calls the
   existing `POST /models/{id}/versions/{vid}/activate`; it is the same action as the Modeller's Publish
   button, in the session's context.

8. **Messages stay metadata-only.** The assistant message stores the `summary` as its `content` and
   `via = "<provider> · <model_id>"`; the change applied lives in the draft, not the message. No
   `proposal` blob — RFC-024 Decision 3 holds unchanged. (Re-opening a session shows the thread; the
   live state of the work is the draft itself.)

9. **Validation before the draft is touched.** The proposal is checked for **referential integrity**
   first — every edge type's `source/target_node_types` must reference a proposed-or-existing node type,
   every property reference must resolve. A bad proposal becomes a structured error reply with **no draft
   mutation**. (This complements `validation_mode` on the model, which still governs the activated
   schema.)

10. **Sync execution; reuse RFC-030's client.** Matches RFC-024 D9 / RFC-030 D9. Streaming deferred.

11. **Events.** Generation emits `model.generate` (`action=MODEL_GENERATE`, `target=session`) with
    `{ provider, model_id, model_id_target, node_type_count, edge_type_count, property_key_count,
    latency_ms, tokens }`. Commit reuses the existing `version.activate` event — fully traceable through
    the standard audit trail.

---

## Design

### Data Model

```python
# invana/sessions/models.py  (additive)
class SessionSurface(enum.StrEnum):
    explorer = "explorer"
    modeller = "modeller"

class Session(Base):
    ...
    surface  : SessionSurface = SessionSurface.explorer    # indexed with (graph_id, created_by_id)
    model_id : str | None      # FK graph_models.id  ON DELETE SET NULL; modeller sessions only
```

No `proposal` / `committed_at` columns — messages stay metadata-only (Decision 8), commit is the
existing activate. Reuses, unchanged: `GraphModel` / `GraphVersion` + `ModelStore` + `Versioner`.

### API Surface

Session creation carries the surface (and optional model binding). **No new execution or commit route** —
generation rides the existing message endpoint; commit reuses the existing activate.

```
POST /api/v1/u/{username}/{graphSlug}/sessions
Request:  { surface: "modeller", model_id?: string, title?, message?: SendMessage }
          # surface defaults to "explorer"; model_id optional (first prompt creates+binds if absent)

POST .../sessions/{id}/messages          # mode:"nl" on a modeller session → propose_model
Response: { user_message, assistant_message, result: null }
          # assistant_message.content = summary; via = "<provider> · <model_id>"
          # the change is in the draft (re-fetch the model/version to render it)

# Commit — REUSED, no new route:
POST .../models/{modelId}/versions/{versionId}/activate     # the existing Publish
```

`send_message` branches on `session.surface`: `explorer` → `nl_to_query` (RFC-030); `modeller` →
`propose_model` (this RFC). QL mode on a modeller session is rejected/ignored (there is nothing to query
in authoring) — the composer hides QL for modeller sessions.

### Generation flow

```
modeller nl send_message
  ├─ resolve provider (RFC-030)
  ├─ ensure target model + draft:
  │    └─ session.model_id ? load its draft (create one if none)
  │       : create GraphModel + initial draft, bind session.model_id
  ├─ ground on the current draft/active version
  ├─ client.complete_tool(... tool=PROPOSE_MODEL ...)        # RFC-030 client
  ├─ validate proposal (referential integrity, Decision 9)   → error reply on failure (no mutation)
  ├─ reconcile proposal → draft (ModelStore create/update, draft-only)
  ├─ assistant_msg.content = summary, via = "<provider>·<model>"
  └─ emit model.generate
# FE re-fetches the model/version → SchemaCanvas + type tree show the updated draft
```

### Studio integration

- **Modeller page** mounts a Sessions panel (Compass rail, surface=modeller) beside the type tree /
  canvas — the same components as Explorer, `useSessions({ surface: "modeller", modelId })`. Generation
  invalidates the `["models", u, g]` query subtree (the existing mutation pattern) so the tree + canvas
  refresh to the new draft.
- **Composer**: NL mode + provider dropdown (reused); QL hidden for modeller sessions.
- **Assistant reply**: the `summary` + a compact "added: N node types, M edge types, K properties" line.
  No canvas special-case — the draft already rendered.
- **Commit**: the session's "Commit" button calls the existing activate mutation
  (`useActivateVersionMutation`) — identical to the Modeller's Publish, in the session's context; the
  same confirm dialog applies. Backend-owned toast.
- Fine-tuning by hand uses the existing node/edge/property dialogs on the same draft — no change.

### Storage / migrations

One Alembic revision: `sessions.surface` (enum, default `explorer`, indexed with the existing
`(graph_id, created_by_id)`) and `sessions.model_id` (nullable FK, `ON DELETE SET NULL`). No backfill
(existing sessions default to `explorer`, `model_id` null).

### Events / admin

`events/actions.py`: add `MODEL_GENERATE = "model.generate"` (reuse `TARGET_SESSION`); commit reuses
`version.activate`. `SessionView` gains `surface` + `model_id`.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| **Also generate + write sample data** (prior draft of this RFC) | Canvas shows populated instances; richer demo | Pulls in the dataset pipeline + connector writes; bends RFC-024 metadata-only; far larger surface | **Dropped** — model-only keeps every write inside draft→activate; data is a clean fast-follow. |
| **A dedicated `proposal` staging table** | Preview without touching the draft | The **draft already is** the staging area (RFC-029); duplicate machinery + admin views | Rejected — generate into the draft (Decisions 4–5). |
| **A new session commit route** | Session-local commit semantics | Re-implements activate; two publish paths to keep in sync | Rejected — commit **is** Publish; reuse `activate` (Decision 7). |
| **A separate "Modeller copilot" entity, not sessions** | No `surface` flag | Re-implements threads / persistence / panel / composer | Rejected — one `surface` column reuses the whole substrate (Decision 1). |
| **Auto-activate after generation (no explicit commit)** | Fewer clicks | No human-in-the-loop; can't fine-tune before saving; breaks the consent/explainability model | Rejected — commit is deliberate (Decision 7). |

---

## Security Considerations

- **Data egress**: generation sends the prompt + the model **schema** (type/property names) to the
  provider — never graph data (there is no data path here). 
- **Write path**: generation only mutates the **draft** (app DB) via draft-only `ModelStore` guards;
  nothing reaches the connector until **commit**, and commit only applies the model's own DDL via the
  existing `Projector`/activate — the same as a hand-authored publish. No new write surface.
- **Authorization**: every route is gated by `require_graph_member` + the session's
  `created_by_id == current_user` filter (RFC-024 D6); the bound `model_id` is re-scoped to the route's
  graph (a cross-graph model id 404s).
- **Validation**: referential-integrity pre-check (Decision 9) + the model's `validation_mode` at
  activation prevent a hallucinated proposal from corrupting the schema. Type/property names are bound as
  parameters by `ModelStore`, never interpolated.

## Performance Considerations

- Generation = one LLM round-trip + a bounded set of draft writes (proposal size). The system prompt
  caps proposed types per turn so a single prompt can't emit hundreds of types.
- Preview is free — the draft is already rendered by `SchemaCanvas`; no extra query/paint.
- Commit = one `activate` (diff + version write) — identical cost to a manual Publish.

## Open Questions

- [ ] **Explicit removals** — should *"remove the Project type"* let generation delete a draft type, or
  is deletion manual-only? Default: conservative (no LLM-driven deletes); revisit if refinement feels
  clumsy.
- [ ] **Draft conflict** — if the model already has a hand-edited draft, generation **appends** to it
  (refinement) with a "discard draft" affordance; confirm this over "require a clean draft".
- [ ] **Iterate after commit** — committing activates the draft; the next prompt opens a fresh draft over
  the now-active version (a new version on the next commit). Confirm this matches the desired loop.

## Implementation Plan

1. [ ] Migration: `sessions.surface`, `sessions.model_id` (nullable FK, SET NULL).
2. [ ] `invana/llm/`: add the `propose_model` intent (tool schema + `generate_model_proposal`) reusing
       RFC-030's `client` + grounding.
3. [ ] `sessions/services`: surface-branch in `send_message` (modeller → ensure model+draft → propose →
       validate → reconcile to draft → summary). Bind `session.model_id` on first generation.
4. [ ] `sessions/routes` + `schemas`: `surface` + `model_id` on create; reject QL on modeller sessions.
5. [ ] `events/actions.py`: `MODEL_GENERATE`; admin: `surface` + `model_id` on `SessionView`.
6. [ ] Studio: Modeller Sessions panel (surface=modeller, reuse components); assistant summary card;
       "Commit" → existing activate mutation; invalidate the models query subtree after generation;
       `useSessions({ surface, modelId })`.
7. [ ] Tests (few, real graph DB + provider key, no mocks): a "people + projects" prompt creates a draft
       with the expected node/edge types and properties; a follow-up prompt refines the same draft;
       commit activates the version; a referentially-broken proposal → error with no draft mutation.
8. [ ] Changeset + add the `mvp.md` scope line below.

## Scope & MVP impact

Modeller generative authoring is **net-new scope** — not in `mvp.md` today (the Modeller is spec'd as
authoring + viewing). Per `CLAUDE.md` this must be surfaced and added before implementation. **Action:**
**the scope line is now in place** — **`mvp.md` § 4.1b — Modeller generative sessions** carries the
Backend / Frontend / Integrations triplet, noting it **depends on the § 6.0 runtime (RFC-032), RFC-030
(translation), and RFC-029 (staged commit)** — **no** dataset or connector-write dependency. It sequences
**after** § 5.7 (RFC-030) lands. This RFC is `Accepted`. The L6 agent loop and any sample-data generation
remain separate and out of scope.

## References

- `docs/internal/mvp/rfc-030-llm-translation.md` — the translation core this RFC extends.
- `docs/internal/mvp/rfc-029-modeller-staged-commit.md` — draft-as-staging, Publish-as-commit.
- `engine/src/invana/modeller/{store,versioner}.py` — draft authoring + activate (the reconcile +
  commit targets).
- `engine/src/invana/sessions/` — the substrate made surface-aware.
- `studio/src/pages/graphs/modeller/components/SchemaCanvas.tsx` — renders the draft preview for free.
