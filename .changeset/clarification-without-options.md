---
"invana": patch
"studio": patch
---

A clarifying question with no options is still a question you can answer.

When the model asked something no list can answer — *"Which country's airports would you like to see?"* — the reply was written to the record with `clarification_options` as `NULL`, which is the same thing the record says about an ordinary answer. Studio reads that column to decide whether a reply is the model asking back, so the question printed as a plain sentence: no options, no `✎ Type your answer below`, not nested under the step that paused, not folded away once answered — under a run still saying *needs input · waiting on your answer*, with nothing on screen to respond to.

The engine now records an empty list rather than `NULL` — *asked, nothing to pick from* is its own state, distinct from *not a question* (docs/for-developers/modules/ask/features/clarifying-questions.md) — and Studio treats the presence of the list, not its length, as the signal. An option-less question now reads like every other one, and points at the composer as the way to answer it.
