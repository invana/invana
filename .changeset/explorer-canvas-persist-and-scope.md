---
"studio": patch
---

Explorer canvas: persist as you go, restore on reopen, and scope to the open session.

The canvas record was only saved on tab blur and never captured the query result
or node-expands, so reopening a session came back to a blank canvas with no way to
reload the data. The live canvas now autosaves (snapshot + positions) as it
changes, an empty saved snapshot is healed by re-running and painting the base
query on open, and a blank snapshot no longer overwrites a good one.

The canvas is a session's layer, so the sessions list (no session open) now shows
a placeholder instead of a stray graph, and operation turns (expand / load) are
right-aligned like the rest of a user's actions.
