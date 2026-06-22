# RFC-039: Self-improving query understanding — the feedback loop (design)

**Status**: Draft (design-only — for discussion, no implementation)
**Author**: Invana Team
**Date**: 2026-06-22
**Related**:
- **RFC-038** (query understanding) — defines *grounding artifacts*, *`user_intents`* (named NL→query
  examples, retrieved as few-shot grounding — **not** a classified taxonomy; see RFC-038's bright
  line), and the *clarification* contract. This RFC defines the **loop that produces and curates those
  artifacts** from real usage.
- **RFC-037** (memory) — the durable store the loop writes into; "personal-first, promote-to-graph" here
  reuses RFC-037's scope model (`scope: user | graph`).
- **RFC-036** (conversation context) — an accepted clarification / a successful rephrase is a turn in the
  thread; the loop reads those as capture signals.
- **RFC-030 / RFC-032** (translation / runtime) — the apply step injects learned artifacts at the
  `_system_prompt` seam (`translate.py:49-57`); no weight updates to the LLM.
- **§5.2** (semantic / vector retrieval) — used by *apply* once the artifact corpus outgrows the prompt.

> **Architecture-agnostic.** This maps the loop, its seams, and decision points neutrally. Two product
> decisions are **settled** (called out below): the loop is **personal-first**, and users **can
> contribute** their learnings to the graph. Everything else is an **open decision**, not resolved here.

---

## Problem / intent

Today a mistranslation or a "can't answer" is a dead end — the correction the user makes (rephrasing,
fixing the query, picking a clarification) is **thrown away**, so the system makes the same mistake
forever. We want it to **learn from mistakes**: capture what the user actually meant, turn it into a
durable artifact, and feed that back so next time it gets it right.

**Honest framing — no reinforcement learning of weights.** The base LLM is a third-party model
(Anthropic / OpenAI / Ollama); we do not fine-tune or RLHF it. "Learning" here is **system-level**:
corrections become artifacts (descriptions, aliases, verified examples, intents — RFC-037/038) that are
fed back via **in-context learning + retrieval**. That is the achievable, provider-agnostic form of
"learning from past mistakes."

This RFC is the **connective tissue**: RFC-037/038 define the *stores and surfaces*; this defines the
*write-and-improve loop* that fills them.

---

## The loop

```
        ┌──────────┐   ┌──────────┐   ┌────────────────┐   ┌────────┐   ┌────────┐   ┌──────────┐
  ask ─▶│ CAPTURE  │─▶ │ DISTILL  │─▶ │ REVIEW/APPROVE │─▶ │ STORE  │─▶ │ APPLY  │─▶ │ MEASURE  │─┐
        │ (signal) │   │ (LLM)    │   │ (human)        │   │(artif.)│   │(prompt)│   │(did it?) │ │
        └──────────┘   └──────────┘   └────────────────┘   └────────┘   └────────┘   └──────────┘ │
              ▲                                                                                     │
              └─────────────────────────── future asks ───────────────────────────────────────────┘
```

### 1. Capture — get ground truth about intent
Signals that a correction happened (which to use is open):
- **Explicit** — a "that's wrong / teach the model" affordance on a failed or unsatisfying turn.
- **Implicit (free signals already in the data):** an accepted **clarification** option (RFC-038 B); a
  user who **rephrases and succeeds**; a user who **hand-edits** the generated query (QL) after an NL
  miss. Each pairs a question with a now-correct intent.

### 2. Distill — LLM drafts a candidate artifact ("LLM helps tune")
The LLM converts the correction into a *proposed* artifact and **routes it by failure type** (it drafts,
it does not decide):

| Failure type | Distilled artifact |
|---|---|
| Vocabulary miss | a description edit / alias, or a verified example `Q → query` |
| Ambiguity | the resolved query (from the chosen clarification) saved as a named `user_intent` |
| Malformed query | a verified example pair (and/or a signal the model is underpowered) |
| **Capability gap** (graph can't answer) | **not** an LLM artifact — a flag to the model developer that the ontology/data is missing (explainability pillar: say "the graph can't answer this") |

### 3. Review / approve — keep humans in control
Candidate artifacts are reviewable/editable before they take effect. Whether this is **auto-staged**
(applies immediately, reversible) or **explicit-approve** (nothing applies until accepted) is open; the
blast-radius guards are RFC-037's (advisory, editable, scoped, read-only).

### 4. Store — as artifacts, personal-first **[settled]**
The approved artifact is written to the RFC-037/038 stores with **`scope: user` by default** — it helps
*that user* immediately. Users **can contribute** a learning to the graph (`scope: user → graph`,
promotion), so the whole team benefits. Capability-gap flags go to the model developer's queue, not the
artifact store.

### 5. Apply — feed it back into translation
Learned artifacts are injected at the translation seam via the context assembler (shared with
RFC-037/038): as **few-shot examples / grounding** while the corpus fits the prompt, and via
**retrieval** (lexical, then embeddings/§5.2) once it doesn't.

### 6. Measure — close the loop
Confirm the artifact helped: replay the originating (or a similar) question and check it now succeeds.
Mechanism is open (per-correction replay, a small regression set of past failures, or aggregate
success-rate tracking). Without this step it's a pile of notes, not learning.

---

## Scope model **[settled]**

- **Personal-first.** A captured learning defaults to the contributing user (per graph), so it improves
  their experience immediately with no gatekeeping.
- **Contributable.** A user can promote a personal learning to the graph, where it applies for all
  members. Reuses RFC-037's `scope` + promotion and (still-open) shared-governance question.

Remaining scope nuance (open): whether promotion **copies** or **moves**, and who may edit/retract a
*contributed* (graph-scoped) learning given binary membership (RFC-023).

---

## Safety / invariants

- **No weight updates** — nothing changes the base model; only the prompt's grounding/examples change.
- **Advisory, not authoritative** — a bad learned artifact degrades a *read* query at worst (RFC-030
  guards stand); never mutates data, never leaks across `scope`.
- **Recoverable** — every artifact is editable/deletable/disable-able; a bad capture is one click to
  undo (and the *measure* step is designed to catch regressions).
- **Capability gaps are surfaced, not hidden** — "the graph can't answer this" is a first-class outcome,
  consistent with the explainability pillar.

---

## Open decisions (to discuss)

1. **Capture signals** — which of {explicit teach, accepted clarification, successful rephrase, query
   hand-edit} feed the loop in v1.
2. **Distill autonomy** — LLM auto-drafts on every correction vs only on explicit teach.
3. **Review policy** — auto-stage (reversible) vs explicit-approve.
4. **Apply timing** — in-context only first, vs retrieval from the start (depends on §5.2).
5. **Measure mechanism** — per-correction replay / regression set / aggregate metric.
6. **Promotion mechanics** — copy vs move; edit/retract rights on contributed learnings (no roles).
7. **Capability-gap routing** — where the "model is missing X" flags go (a developer queue? an issue?).
8. **Relationship to RFC-037/038 docs** — keep three RFCs, or merge once decisions settle.

---

## Non-goals

- No fine-tuning / RLHF / weight updates of the LLM.
- No implementation in this RFC — design for discussion.
- No result-payload persistence change (RFC-024 unchanged); no provider-side state (RFC-036).

---

## MVP scope note

The feedback loop is Layer-6 agent-grounding scope, built on RFC-037/038 (also not yet in MVP). Add the
agreed pieces to `mvp.md` before implementing, per repo rule 5.
