# RFC-040: Consolidate graph "intent" into `Graph.instructions`; remove the instructions table

**Status**: Accepted — implemented
**Author**: Invana Team
**Date**: 2026-06-24
**Related**:
- **RFC-017** (Graph as primary container) — folded Mission's `intent`/objectives onto `Graph`.
- **`docs/system-design.md` §"Instructions"** — the original concept: a mission's standing contract
  (Objectives + Goals + Success Criteria). `Graph.intent` was effectively its "Objectives" part.
- **MVP §2.5 / S5** — shipped the separate `instructions` table; this RFC removes it.

---

## Problem

The platform carried **two overlapping surfaces** for a graph's standing guidance to its agents:

1. **`Graph.intent`** — a single nullable `Text` field (the graph's mission statement / purpose), a
   **required setup-wizard section**, edited via studio's `IntentSection`.
2. **`instructions` table** — a graph-scoped table of named, prioritized directives
   (`{name, content, priority}`) with CRUD, an admin view, event verbs, and a studio `InstructionsSection`.

In the original design these were **one concept** ("Instructions"); the MVP split it. Worse, the
`instructions` table is **completely unwired**: nothing in the LLM/translation path reads it, and its
only intended consumer (the Layer-6 agent loop, `mvp.md:397,402`) is unbuilt. So we shipped, and were
maintaining, a dead table that duplicates a live field and confuses the vocabulary.

A second motivation: the word **"intent"** is wanted for the NL→query learning artifacts
(`user_intents`, RFC-038). Freeing it here unblocks that naming.

## Decision

- **Rename `Graph.intent` → `Graph.instructions`** — a single, ChatGPT-/Claude-project-style "custom
  instructions" block per graph. (`objectives` / `success_criteria` columns are untouched.)
- **Remove the `instructions` table** and everything hanging off it (module, routes, admin view, event
  verbs, studio section + data layer). When the agent loop is built it will read `Graph.instructions`.
- **Rename the setup-wizard required section** `intent` → `instructions` (and migrate the
  `setup_state` JSON key on existing rows so completion state survives).
- **`skills/`** (the unwired sibling table) is **left as-is** — a genuinely distinct concept.

### Why remove rather than keep

Keeping an unused, speculative table "for when agents arrive" is exactly what the MVP no-scaffolding
rule (CLAUDE.md MVP rule 2) discourages. Removal breaks no behavior (it was never read), deletes real
maintenance surface, and a richer rules-engine shape can be reintroduced later if a need actually
appears. The single field covers every current consumer (NL grounding, future agents).

## Changes

**Engine**
- `graphs/models.py` `intent` column → `instructions`; `graphs/schemas.py` `Graph{Create,Update,Read}` +
  `SETUP_SECTIONS`/`SETUP_REQUIRED`; `graphs/services.py` create + setup-completion + read mapper;
  `graphs/deps.py` docstring.
- Deleted `invana/instructions/` package; removed its router include (`server/app.py`), admin
  `InstructionView` + import (`server/admin/views.py`, GraphView field `intent`→`instructions`), and the
  `instruction.*` action verbs + `TARGET_INSTRUCTION` (`events/actions.py`).
- Migration `000000000020`: `alter_column` rename (data-preserving), portable `setup_state` JSON-key
  rename, `drop_table("instructions")`; reversible `downgrade`.

**Studio**
- Deleted the table-based `InstructionsSection` + `useInstructions` + `api/instructions` +
  `types/instructions`. Renamed `IntentSection` → a single-field `InstructionsSection` wired to
  `Graph.instructions`.
- `types/graphs.ts`, `GraphCreatePage`, `InfoSection`, `GraphsListPage` field rename; nav/settings
  registration collapsed from two entries (Intent + Instructions) to one (`useSettingsPanel`,
  `useGraphLeftNav`, `SettingsPanel`); `SetupWizard` + `SetupRequiredBanner` section + copy.

## Safety / invariants

- **Data-preserving**: the rename keeps existing `intent` values and wizard-completion state; the
  migration round-trips up and down (validated on SQLite).
- **No behavior change** beyond vocabulary + the removal of a never-read table — the setup gate still
  requires `graph_info` + (now) `instructions`.

## Non-goals

- The NL→query learning subsystem (RFC-037/038/039 consolidation) — separate follow-up; this RFC only
  frees the "intent" name and tidies the instructions concept.
