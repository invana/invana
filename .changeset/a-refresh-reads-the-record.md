---
"invana": patch
---

A refresh reads the record; it does not re-ask the graph.

A natural-language question answered, its table drawn from the records it cited. Reloading the
page turned the same reply into a Neo4j syntax error — with the English sentence quoted back as
the offending query:

> Invalid input 'whats': expected 'FOREACH', 'ALTER', 'ORDER BY', … "whats longest airport"

Opening a session re-ran its last query to repaint the canvas, and that re-run asked the wrong
thing. It opens a `ql-query` run — validate, execute, project, no translation — but took its body
from the run that answered before, which for a natural-language ask is the *question*. Nothing
downstream translates it again, so the sentence went to the driver. Worse, the re-run re-pointed
the reply at itself: the emissions the first answer wrote were orphaned, so a failed restore
erased the answer that was on screen.

A re-run now asks the reply's stored query, and a `ql` run reads its query from the ask rather
than from the user's message — the row that, on a re-run, still holds the question.

And a reload no longer re-runs at all. The answer and the drawing are both records: the `project`
step writes an emission, the board holds a snapshot. Restoring a session paints the snapshot and
renders the stored emissions; re-running is the fallback for a board that has none — which heals
boards saved blank before autosave existed — and the explicit **Re-run** on a reply. A page that
re-queries on arrival spends against the graph on every refresh and can quietly answer
differently from the answer being read, with nothing saying so.
