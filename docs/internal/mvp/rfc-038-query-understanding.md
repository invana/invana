# RFC-038: Query understanding — developer-tunable grounding + interactive clarification (design)

**Status**: Draft (design-only — for discussion, no implementation)
**Author**: Invana Team
**Date**: 2026-06-22
**Related**:
- **RFC-030 / RFC-032** (LLM translation / runtime) — `_system_prompt` (`translate.py:49-57`) is the
  single seam where graph context becomes the system prompt; today it renders schema as `name:type`
  only (`grounding.py:36`) and **drops the descriptions** that already exist on the model.
- **RFC-036** (conversation context) — a clarification answer becomes the next turn and is carried
  forward by the existing context window; the two features compose.
- **RFC-037** (memory) — the durable sibling layer; the prompt-assembly seam proposed there is where
  tuned grounding also plugs in. A confirmed clarification could later feed memory (out of scope here).
- **`instructions/` + `skills/`** — graph-scoped, authorable, currently unwired; candidate homes for
  some tuning artifacts.
- **§5.2** (semantic / vector retrieval) — not built; relevant only for *scale* (selecting from a
  tuning corpus too large to fit the prompt).

> **Architecture-agnostic.** This RFC maps the design space, the seams, and the decision points with
> neutral trade-offs. Where a choice exists (what to author, where it lives, when to clarify, how
> options are sourced, selection strategy) it is listed as an **open decision**, not resolved. Schemas
> shown are illustrative supersets, not commitments.

---

## Problem / intent

An ask like *"show me the top 10 airlines based on length in order"* failed with the generic
*"I couldn't turn that into a query…"* even though the model has a `longest` property. Root causes:

1. **Grounding is impoverished.** The prompt shows `longest:integer` but not its meaning, and offers no
   bridge between the user's vocabulary ("length", "airlines") and the schema's vocabulary (`longest`,
   and whichever label actually carries it). The model is left to guess.
2. **Uncertainty dead-ends.** When the model is unsure, the only outcomes today are a (possibly wrong)
   query or a generic failure. It cannot **ask**.
3. **No tuning surface.** The people who know the data — the **model developers** — have no knob to
   teach the LLM how their domain language maps to the graph, or what the common intents are. The
   understanding logic is implicit in code, not authorable per graph.

Intent: make query understanding **better and tunable** — richer, developer-authored grounding; and an
interactive **clarify-with-options** behaviour when the model is unsure, instead of failing.

---

## Capabilities

### A. Developer-tunable grounding (the central pillar)

The model developer can author signals that shape how the LLM reads both the **question** and the
**data**. Candidate authorable artifacts (which to include is open):

- **Descriptions** — already on `NodeTypeDefinition`, `EdgeTypeDefinition`, `PropertyKey`
  (`modeller/models.py`), just not rendered. Surfacing them lets the LLM map "length"→`longest`
  itself (LLMs are strong at synonymy given meaning).
- **Aliases / synonyms / vocabulary** — explicit user-term → schema-element mappings
  ("carrier"→`Airline`, "size"→`longest`) for cases descriptions don't cover.
- **Units / value hints / examples** — "`longest` is in feet", sample values, enums.
- **`user_intents`** — named NL→query exemplars ("longest airports" → a known-good query), usable as
  few-shot grounding **and** as clarification options (see B). **[settled — naming + mechanism]**
  We keep the term *intent* but **not** the chatbot-era mechanic. A `user_intent` is:
  ```
  user_intent { name, description, phrasings[]?, example_query }
  ```
  At runtime intents are **retrieved by similarity and injected as few-shot examples for the
  generator** — the LLM still generates (and adapts: different limit, extra filter, blends two
  intents), no match still works from schema grounding alone, and intents are an **open, additive
  set**, not a closed taxonomy.
  > **Bright line (do not cross):** never add a step that does `classify(question) → intent_id →
  > return intent.example_query`. Intents *ground* generation; they never *route to a canned query*.
  > That single rule is what keeps this from regressing into old-school intent recognition.
  Naming them is a deliberate win: the LLM can cite them ("used your *longest airports* intent, limit
  5") — good for explainability — and a captured correction (RFC-039) becomes a named `user_intent`.
- **Clarification hints / policy** — per-graph guidance on when/what to ask.

Cross-cutting questions (open):
- **Where do these live?** Extend the model schema (descriptions + new alias/example fields)? Reuse the
  existing `instructions/` / `skills/` surfaces? Introduce dedicated tuning tables? A mix?
- **Who authors / what scope?** Graph-level config (like instructions/skills today), and/or per-user?
- **Versioning** — do tuning artifacts version with the `GraphVersion`, or live independently?

### B. Interactive clarification (ask instead of fail)

Give translation a second structured output so forced tool-use can choose between answering and asking:

```
submit_query{ query, language, read_only, rationale }            ← confident
request_clarification{                                            ← unsure / ambiguous
  question,
  options: [ { label, explanation, candidate_query } ],   # options are GENERATED per ask, not picked from a fixed intent registry
  allow_free_text: bool
}
```

- A `request_clarification` result renders as **selectable options** — heading + explanation each, plus
  a free-text "describe instead" — the Claude-Code / quick-reply shape.
- Selecting an option (or typing) becomes the **next user turn**, carried forward by RFC-036 context,
  and re-translated with the resolved intent.
- The same mechanism is a **recovery path**: replace the dead-end error with options
  (*"Did you mean — longest runway (`Airport.longest`) / number of routes / fleet size?"*).

Open decisions:
- **When to clarify** — model-decided (it picks the tool), a confidence threshold, or only after an
  execution failure (recovery-only). Any combination.
- **Where options come from** — model-generated candidates, retrieved `user_intents` (A) used as
  grounding, schema/alias matches, or a blend. (Options are always *generated/assembled per ask*,
  never selected verbatim from a fixed intent list — the bright line above.)
- **Option mechanics** — single vs multi-select; whether a click sends a canned phrase or a structured
  intent hint; how many options.

### C. Optional similarity / retrieval (scale only)

When the tuning corpus (aliases, intents, descriptions) is too large to inject wholesale, select a
relevant subset per ask. Variants: lexical/fuzzy (no infra) or embedding-based (depends on §5.2).
Layered on A; not required while the corpus fits the prompt budget.

---

## The seam (factual)

Everything composes at one place: the context assembler feeding `_system_prompt`
(`translate.py:49-57`), the same seam RFC-037 proposes. Tuned grounding (A) and any selected
intents/aliases (C) are sources the assembler orders and budgets; the clarification contract (B) is a
change to the translation **output schema** in `nl_to_query`, threaded back through `send_message` so an
ambiguous turn persists as an interactive assistant message instead of an error. Ordering, budgeting,
and prompt-cache placement are open (shared with RFC-037).

---

## Data model (illustrative supersets — not commitments)

Two shapes, depending on the open "where does tuning live" decision:

- **On the model:** add renderable fields where missing — e.g. `PropertyKey.aliases`,
  `PropertyKey.unit`, `*.examples`. Descriptions already exist.
- **As tuning artifacts:** e.g. a `graph_query_aliases` (term → target element) and `user_intents`
  (name, description, phrasings, example_query, scope, enabled) table — or fold into
  `instructions/` / `skills/`.

Clarification needs no new persistence beyond an assistant-message variant: the existing
`session_messages` row can carry a clarification payload (question + options) the same way it carries a
query result today (status/metadata only — RFC-024 unchanged).

---

## Composition & safety

- **Composes with context (RFC-036):** the clarification answer is just the next turn; no special
  plumbing.
- **Composes with memory (RFC-037):** tuning artifacts and memory both flow through the one assembler;
  a confirmed clarification *could* later be remembered (explicitly out of scope here).
- **Invariants hold:** translation stays read-only (RFC-030 guards); a clarification can't execute
  anything; tuning artifacts are authored config — auditable, editable, and advisory (a bad alias
  degrades a read query at worst, never mutates data).

---

## Open decisions (to discuss)

1. **Tuning artifacts** — which of {descriptions, aliases, units/examples, `user_intents`,
   clarification hints} are in scope for v1?
2. **Where they live** — model schema fields vs `instructions`/`skills` vs new tuning tables vs mix.
3. **Authoring scope** — graph-level only, or also per-user; versioned with `GraphVersion` or not.
4. **Clarify trigger** — model-decided / confidence threshold / recovery-only / combination.
5. **Option source** — model-generated / retrieved `user_intents` / schema matches / blend (always
   generated per ask, never classified — see the bright line).
6. **Option mechanics** — single vs multi-select; canned phrase vs structured hint; count.
7. **Selection at scale** — when (if) to add retrieval; lexical vs embeddings (§5.2).
8. **Assembler** — does this ship the RFC-037 context-assembler, or a narrower grounding-only version?

---

## Non-goals

- No implementation in this RFC — design for discussion.
- No memory write-back from clarifications (RFC-037 territory).
- No result-payload persistence change (RFC-024 unchanged).
- No provider-side state (stateless runtime preserved — RFC-036).

---

## MVP scope note

Richer grounding (A) is close to RFC-030's existing rails; interactive clarification (B) and a tuning
surface (C) are new agent-grounding scope. None are in the current MVP — add the agreed pieces to
`mvp.md` before implementing, per repo rule 5.
