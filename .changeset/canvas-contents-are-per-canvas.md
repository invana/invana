---
"studio": patch
---

Step 2 of the Explorer page host: canvas contents are held **per canvas**, not
per page.

Five `useState`s at page level — contents, seed, styling, selection, and the
elements the graph no longer holds — described *one* canvas while the page
hosted many. That is why switching a tab had to repaint the single canvas: an
API round-trip, a destructive re-seed, and every node position lost.

`useCanvasStates(activeCanvasId)` gives each canvas its own slice and hands back
the same five values and five setters, resolved against whichever canvas is
active. Every one of the ~30 call sites reads and writes exactly as before —
this is a change of *where* the state lives, not of who writes it.

Two details that make it a drop-in rather than a rewrite:

- **The setters stay stable.** They replace `useState` setters that ~30 sites
  pass into `useCallback` deps and effects, so the active key is read through a
  ref at call time rather than closed over. A setter whose identity changed with
  the active canvas would re-create all of them.
- **A draft key.** A query can paint before its canvas row exists — a first
  question in a new session answers, and only then is a canvas created. That
  paint lands under `__draft__` and is adopted under the real id the moment one
  appears, so nothing is lost in the gap.

Closing a tab now forgets its slice, so the record does not accumulate every
canvas a session ever opened.

Verified in the browser: two sessions open as two tabs, each keeping its own
contents across switches — 7 nodes / 6 edges and 10 nodes / 0 edges, correct in
both directions.
