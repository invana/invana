---
"invana": patch
---

Committing stitches is a run, under the Graph's guardrails (ST54).

The Stitches drawer and `invana stitches commit` / `apply --commit` now open `stitch-commit@1` — one
`commit_stitches` step — instead of writing edges directly. The Graph's guardrails are frozen on the
run and asked about each stitch's two models before any edge is written: a stitch whose model a
guardrail denies is committed and writes nothing, and the drawer's message says how many did. The
commit shows up in Runs with its trace. Nothing staged, no connection and a read-only connection
are refused before a run is opened, with the same responses as before.
