---
"studio": patch
---

Activity reads as a timeline (docs/for-developers/modules/operate/features/audit-and-activity.md AA6).

The graph's Events panel drops the stack of bordered cards for `TimelineList` in its `rail` variant — the shape for a docked, narrow panel, where a fixed `when` column would eat a third of the width. A `StatusDot` in the rail carries the event's derived outcome (`success · error · muted`), `when` reads *2m ago · @someone*, the verb is the entry's line, and the full record still opens in place under it. `Load older` sits in the `TimelineFooter`, so the rail runs on into it — the line itself says the history continues past what is loaded.
