---
"invana": minor
"studio": minor
---

Explorer NL: the model can ask a clarifying question instead of guessing.

When a natural-language ask is genuinely ambiguous — a likely typo of a label/property/value, a reference it can't resolve, or something the schema can't express — translation now returns a short clarifying question instead of guessing a query (RFC-038). The question is persisted as a normal assistant reply; the user answers in the composer and the clarification exchange is replayed as conversation context (RFC-036), so the model remembers what it asked.

Clarifying is deliberately rare: the model is instructed to translate confidently for any clear request — including obvious follow-ups like changing a limit, choosing columns, or adding filters that map cleanly — and to ask only when it truly can't proceed. The "context used" disclosure renders clarification turns distinctly (Asked → Clarified).

Clarifications can offer **clickable options** so the user picks instead of retyping — and these can be **data-driven**: when the choice is which value to pick (e.g. which country), the model supplies a read-only `options_query` that the backend runs to offer the real distinct values from the graph, alongside a "Something else — let me type" escape that focuses the composer. Options + the generated query are **always capped** (LIMIT 10 by default unless the user names a count) and a "show all / list everything" option is never offered — the graph may hold millions of rows. Adds a nullable `clarification_options` column (migration `00000000001e`).
