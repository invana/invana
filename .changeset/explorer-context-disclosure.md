---
"invana": minor
"studio": minor
---

Explorer: see the conversation context behind an NL reply.

Each natural-language assistant reply now has an **info icon** (next to re-run / view-query / copy) that opens a "context sent to the model" disclosure — the prior turns (your prompt + the generated query) that were replayed for that translation (RFC-036/040). First-turn replies show "no prior context"; QL replies have no icon (they send no context).

The context isn't stored — a small read-only engine endpoint (`GET …/sessions/{id}/messages/{messageId}/context`) recomputes it from the prior turns using the exact same functions the translation uses, so what you see is precisely what was sent. Studio fetches it lazily when the disclosure is opened.
