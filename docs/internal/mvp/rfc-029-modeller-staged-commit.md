# RFC-029: Modeller staged-commit editing (draft is the stage, Publish is the commit)

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-14
**Related**:
- **RFC-021** (Model authoring) — established the draft→active version lifecycle and the granular
  per-entity authoring endpoints this RFC re-frames (does not replace).
- **RFC-027** (Interactive modeller canvas) — the canvas gestures that also write to the draft.
- **RFC-028** (Backend-owned action messages) — the central action-toast this RFC suppresses for
  draft edits and keeps for the single Publish/commit.

---

## Problem / intent

Editing a model in the Modeller *feels* like a stream of committed actions. Every property add, every
node/edge-type create or edit fires a request that persists to the draft immediately and toasts a
backend-owned success ("Property added.", "Node type created."). To the author it reads as "each edit
is live," when in fact nothing reaches the active model or the physical database until **Publish**.

The author's mental model is git-like: *assemble the whole definition, then commit it once.* We want
the Modeller to read that way — edits accumulate quietly in a staging area, and a single deliberate
action commits the whole model.

## Decision: re-frame, don't re-plumb

Two staging models were considered:

- **(A) Re-frame the existing draft as the stage.** Keep server-side per-edit persistence, but make the
  UX say what is already true: a draft is an uncommitted staging area, and Publish is the commit of the
  whole definition. *Chosen.*
- **(B) True client-side staging.** Hold the full definition in a client store, write nothing until a
  new transactional `PUT .../versions/{draftId}/definition` endpoint applies it atomically. Rejected for
  the MVP: large data-flow refactor, the client would have to manage temp IDs + cross-references
  (edge→node-types, mappings→keys) and front-run server validation, and it loses the draft's free
  reload-durability. Recorded here as the future path if zero-write staging is ever required.

The draft **already** provides the only guarantee that matters — nothing leaks to the active model or
the DB before an explicit action. So the change is UX framing, not new persistence machinery.

### Decisions (locked)

1. **Draft edits are silent ("staging").** All draft-version type-authoring writes — node/edge type
   create·edit·delete, property add·edit·remove, and canvas gestures (erase, reverse) — suppress their
   per-request RFC-028 action toast and emit **no** summary toast. Visual confirmation comes from the
   canvas / nav / detail updating optimistically off the refetched draft. Errors still toast
   (unchanged). Implemented at the React call sites via the existing `suppressActionToast`, scoped to
   the Modeller — the shared client is untouched.

2. **A persistent "unpublished changes" indicator.** While an editable draft with content is open, the
   lifecycle footer shows an explicit *staged / unpublished* indicator next to the commit control, so
   the author always knows there are changes not yet committed. A draft-with-content *is* the dirty
   state; no new flag is needed.

3. **Publish is the single commit, made deliberate.** The whole-model commit boundary (chosen over
   per-entity) stays the existing activate endpoint (returns "Model published." — the one toast we
   keep). Publishing now goes through a confirmation dialog summarising what is being committed (N node
   types, M edge types, K property keys). The redundant draft-footer **Save** button is removed:
   edits autosave to the stage and the breadcrumb already returns to the list, so "Save" only implied a
   commit that Publish owns.

4. **No backend change in this slice.** A free-text *change summary* on commit (persisted to
   `version.change_summary`) is desirable but needs `VersionActivate` to accept it; deferred to a
   follow-up so this slice stays frontend-only.

## Out of scope / deferred

- Option (B) transactional bulk endpoint and client-side definition store.
- Change-summary capture on Publish (needs `VersionActivate` extension).
- Per-entity commit (explicitly rejected — commit boundary is the whole model).
- "Discard draft" affordance (delete the draft version) — independent follow-up.
