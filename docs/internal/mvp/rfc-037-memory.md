# RFC-037: Cross-session memory (design)

**Status**: Draft (design-only — no implementation)
**Author**: Invana Team
**Date**: 2026-06-22
**Related**:
- **RFC-036** (NL conversation context) — per-session context. Memory is the cross-session
  counterpart; this RFC reuses RFC-036's prompt-assembly seam.
- **RFC-030 / RFC-032** (LLM translation / runtime) — `_system_prompt` (`translate.py:49-57`) is the
  single place graph context becomes the system prompt; it currently injects schema only.
- **Instructions** (`instructions/`, §2.4) and **Skills** (`skills/`, §2.5) — graph-scoped tables that
  exist but are **not wired into translation today**. They share the same injection seam as memory.
- **RFC-023** (roles removed) — graph membership is binary; there is no owner/member/admin role.
- **§5.2** (semantic / vector retrieval) — not yet built; relevant to memory selection at scale.

> This document is deliberately **architecture-agnostic**. It defines the primitives, the seam, and a
> data model that is a *superset* able to express any of the policies discussed. Where a policy choice
> exists (scope, write path, governance, selection, incognito semantics), it is listed as an **open
> decision** with neutral trade-offs — not resolved here. Implementation requires resolving the open
> decisions in a follow-up (or an amendment to this RFC).

---

## Problem / intent

Per-session context (RFC-036) makes a follow-up refine the current thread. It does not carry anything
across threads: a user re-teaches the system the same disambiguations, vocabulary, and preferences in
every new session. The intent is a durable layer — a **memory** — that persists learned facts across
sessions for a graph, is user-editable, can be added automatically, and can be excluded for a given
session.

This RFC frames *what the primitive is and where it plugs in*, so the team can decide *how* it behaves.

---

## Primitive decomposition (descriptive)

The LLM ecosystem (Claude, ChatGPT, Perplexity) separates durable model-side context into distinct
primitives rather than one blob. Mapped to Invana's existing surfaces:

| Primitive | Nature | Determinism | Invana surface |
|---|---|---|---|
| **Instructions** | Authored directives, always applied | Deterministic, every call | `instructions/` (exists, unwired) |
| **Skills** | Invokable capabilities (how/when) | Conditional | `skills/` (exists, unwired) |
| **Memory** | Accumulated facts/preferences | Selectively injected | *new (this RFC)* |
| **Context** | Current thread's turns | Within-session | RFC-036 (done) |

These are siblings, not substitutes. The decomposition is presented as the shared frame; which
primitives are *enabled* and *wired* is an open decision (see below).

---

## The injection seam (factual)

All durable context becomes a system prompt at one place: `_system_prompt`
(`engine/src/invana/llm/translate.py:49-57`), today schema-only. `nl_to_query` already threads `version`
(schema) and `history` (RFC-036) from `send_message`. Memory (and instructions/skills, if wired) would
thread through the same path as additional composed sections.

A neutral way to model this is a **context-assembly step** that produces the ordered sections fed to
`_system_prompt`. The assembler is the single owner of *ordering, precedence, and budgeting*; the
individual primitives are just sources. This keeps the policy out of `translate.py` and out of each
source module.

```
assemble_context(graph, user, session, ask) -> ordered sections
    └─ sources: schema · instructions · skills · memory · session-context
```

Ordering, precedence between sources, token budgeting, and prompt-cache placement are **open** (a
stable→volatile order is one option, for cache friendliness, but not mandated here).

---

## Data model (superset — policy-neutral)

A single `graph_memories` table whose columns can express every policy under discussion. No policy is
encoded by the schema; behavior is layered on top.

```
graph_memories
  id            pk
  graph_id      fk graphs.id (CASCADE)            -- always graph-anchored
  user_id       fk users.id  (CASCADE), NULLABLE  -- the owner; NULL ⇒ graph-level (shared)
  scope         enum                              -- e.g. {user, graph} (+ optional {global} later)
  content       text                              -- one discrete fact / preference ("the gist")
  source        enum                              -- e.g. {manual, auto, promoted}
  status        enum                              -- e.g. {active, proposed, archived}
  pinned        bool                              -- selection / ordering hint
  enabled       bool                              -- per-item on/off without delete
  created_by_id fk users.id                       -- attribution (audit), distinct from owner
  created_at / updated_at
```

Why this shape is agnostic:
- **Scope** is a discriminator + nullable `user_id`, so "user-per-graph", "graph-shared", and a future
  "global per-user" all fit without migration churn. Which scopes are *enabled* is an open decision.
- **`source` + `status`** together express any write path: an auto-commit policy creates
  `source=auto, status=active`; a propose-confirm policy creates `status=proposed` until approved; an
  explicit-only policy only ever writes `source=manual`. The schema commits to none of these.
- **`enabled`/`pinned`** support per-item control and any selection strategy.
- **`created_by_id` ≠ `user_id`** lets a shared item record who contributed it (governance/audit)
  independent of who owns/curates it.
- A companion **version/audit trail** (append-only, like the Anthropic memory tool's
  versions/redact) is an option for blast-radius safety; whether to include it is open.

A session-level **incognito** flag (`sessions.incognito` boolean, or an equivalent per-ask parameter)
governs memory read/write for that thread; its exact semantics are an open decision (block read,
block write, or both).

---

## Capabilities (what the feature exposes — variants left open)

- **Add** — manual ("remember this"), automatic (extracted from sessions), or both. The *trigger*
  (per-turn / session-end / explicit) and whether auto items are live or staged are **open**.
- **Edit / delete / enable-disable** — CRUD on items. Always available for a user's own items;
  applicability to shared items depends on governance (open).
- **Promote (contribute to graph)** — elevate a personal item to graph scope (`scope: user → graph`,
  `source: promoted`). Who may promote, and whether promotion copies or moves, is **open**.
- **Incognito session** — exclude a thread from memory. Read/write semantics **open**.
- **Quarantine a bad session** — recover from a poisoning event. Options range from per-item delete to
  a per-session purge (delete all auto items attributed to a given session); **open**, and may depend
  on whether items record their originating `session_id`.
- **Extraction (the "gist")** — distill sessions into discrete facts rather than storing transcripts.
  The extractor (an LLM call), its trigger, dedup strategy, and cost controls are **open**.

---

## Selection (how items reach a prompt — open)

Items cannot all be injected indefinitely. Model selection as a pluggable step
`select(items, ask, budget) -> items` so any strategy fits behind one interface:
- naive: all enabled items for the in-scope set, ordered by pinned then recency, capped by budget;
- semantic: relevance-ranked via embeddings (depends on §5.2);
- hybrid.

Which strategy ships first is an **open decision**; the interface keeps it swappable.

---

## Safety framing (invariant, not a policy)

Independent of the choices above, two invariants bound the blast radius:
- **Advisory, not authoritative** — memory is grounding text; the read-only translation guards
  (RFC-030) and read-only execution guards stand, so a wrong/poisoned memory can only degrade a *read*
  query, never mutate data.
- **Scope-bounded** — a memory item is injected only for prompts within its `scope`, so it cannot leak
  across users (for `user` scope) or graphs.

These make "bad memory" recoverable by editing/deleting/disabling one item, and motivate (but do not by
themselves decide) the mitigations above (gist-not-transcript, editability, incognito, attribution).

---

## Open decisions (to resolve before implementation)

1. **Enabled scopes** — user-per-graph only, also graph-shared, also a global per-user layer?
2. **Write path** — auto-commit, propose-confirm, explicit-only, or a mix (via `source`/`status`).
3. **Extraction trigger & cost** — per-turn / session-end / explicit; sync vs async; dedup.
4. **Shared-item governance** — given no roles: creator-guarded, open/wiki, or owner-curated.
5. **Incognito semantics** — block read, block write, or both.
6. **Selection strategy for v1** — naive cap vs semantic (depends on §5.2).
7. **Instructions/skills wiring** — wire the existing (dead) primitives through the same assembler now,
   or in a separate change? Defines whether the assembler ships with 1 source or 4.
8. **Audit/versioning** — include an append-only memory-version trail, or rely on plain CRUD?
9. **Assembly ordering & prompt-cache placement** — precedence between sources; budgeting.

---

## Non-goals

- No implementation, schema migration, or routes in this RFC — design only.
- No result-payload persistence (unchanged from RFC-024).
- No provider-side session/memory (stateless runtime preserved — see RFC-036).

---

## MVP scope note

Cross-session memory is a Layer-6 / agent-grounding subsystem, not a thin slice on existing rails
(unlike RFC-036). It is **not** in the current MVP scope and must be added to `mvp.md` as an explicit
future item/slice before any implementation, per repo rule 5 (no silent re-scoping).
