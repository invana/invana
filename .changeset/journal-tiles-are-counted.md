---
"invana": minor
---

The Runs board and the Imports page count every run, not the page. `GET …/runs/stats` (and `GET /api/v1/runs/stats` across your Graphs) returns the live, today, tokens and slowest tiles, the failed count, the median time and runs per day — in your time zone's days. The journal's *N of M shown* is a real count, a run read carries its step progress, and the assistant's live token count comes from the engine on every finished step.
