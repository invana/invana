---
"invana": minor
"studio": minor
---

Modeller generative sessions — author a graph model by chat (RFC-031).

The Modeller gains a "Messages" panel: describe a model in natural language
("model people and the projects they work on") and the LLM proposes node/edge
types + property keys straight into the model's **draft**, rendered live on the
canvas and type tree. Refine by more prompts or by hand on the same draft, then
**Commit** — which reuses the existing Publish/activate. Model-only: no sample
data and no connector writes; everything stays inside the draft→activate path.

Sessions are now surface-aware (`explorer` | `modeller`). A modeller session
binds to one model (`Session.model_id`); the first generation creates + binds a
model when none is open. Generation grounds on the current draft, validates the
proposal's referential integrity before any write, then reconciles it
conservatively (create missing types/keys, add properties by name, never delete).
A new `model.generate` audit event records each generation (provider, target
model, counts, tokens, latency). Composer is NL-only on the Modeller; query mode
is rejected there.
