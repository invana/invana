---
"invana": patch
---

Renaming an LLM endpoint is refused while a world or a guardrail names it (PM18).

The endpoint's `name` *is* the middle segment of `llm/<name>/<model>`, so a rename moves every
address under it in one write. Nothing rewrote what named the old one: a `cast` naming
`llm/anthropic-prod/claude-opus-5` and the `deny llm/anthropic-prod/**` that bounded it both stopped
resolving, and a bound that matches nothing bounds nothing — the exact widening the provider-split
migration rewrote addresses to prevent, reachable from the edit form.

`PATCH …/llm/{id}` now asks the question removal already asked of one model, of the whole row: every
**named** lens in the Graph is read — its `cast` values and, structurally, every string in its
`rules`, so a pattern that names no single address still counts — and a rename is refused with those
worlds listed. The recourse is to retune them first, or to configure a second endpoint under the new
name. Nothing else on the row is addressed, so the credential, the base URL and the guardrails edit
without a question, and the form says what a rename costs under the field rather than at the save.
