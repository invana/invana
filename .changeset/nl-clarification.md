---
"invana": minor
"studio": minor
---

Explorer NL: the model can ask a clarifying question instead of guessing.

When a natural-language ask is genuinely ambiguous — a likely typo of a label/property/value, a reference it can't resolve, or something the schema can't express — translation now returns a short clarifying question instead of guessing a query (RFC-038). The question is persisted as a normal assistant reply; the user answers in the composer and the clarification exchange is replayed as conversation context (RFC-036), so the model remembers what it asked.

Clarifying is deliberately rare: the model is instructed to translate confidently for any clear request — including obvious follow-ups like changing a limit, choosing columns, or adding filters that map cleanly — and to ask only when it truly can't proceed. The "context used" disclosure renders clarification turns distinctly (Asked → Clarified). No new storage or migration.
