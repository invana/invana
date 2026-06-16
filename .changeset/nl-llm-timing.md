---
"invana": minor
"studio": minor
---

Surface LLM translation time for NL queries, in traces and the response.

An NL turn does two things: the LLM translates the prompt into a query, then the engine runs that query. Previously only the query time was visible. Now:

- The LLM translation step is traced (`llm.translate` / `llm.generate` spans with model id and token counts), so it shows up in the same FE→BE trace as `graph.query.db_execute` (RFC-025).
- The engine times the translation and persists it on the assistant message (`llm_time_ms`), returning it in the sessions API.
- The Explorer thread shows both times labelled — e.g. `LLM 1.2s · query 8ms` — so it's clear which step dominated a turn. QL turns and reruns (no translation) show just the query time.
