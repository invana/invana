---
"invana": minor
"studio": minor
---

The Explorer's left panel: what this graph holds, and what is selected.

Opening the Explorer used to land on the Sessions list. It now lands on the
panel the hi-fi draws — `NODE TYPES`, `RELATIONSHIPS` and `SELECTED` stacked in
one collapsible, resizable column. Each type row carries the colour the canvas
paints it with, so the list is the drawing's legend as well as an inventory, and
the footer states `<n> types · <total> nodes` beside the open canvas's name.

The eye on a node-type row hides that type on the open canvas and nothing else:
no query re-runs, and the row's count does not move, because the count is
graph-wide while the canvas is only what you happen to be looking at.

Engine: `GET /api/v1/u/{username}/{graphSlug}/explorer/type-counts` returns every
node and edge type with its count, biggest first, read through the connector's
schema reader. Cypher and Gremlin both count; a vendor that cannot still names
its types, and the panel shows them without numbers rather than showing nothing.

The type dots read `@invana/styling`'s categorical data palette
(`--color-data-1…8`), which ships with this work — one scale shared by the
panel, the canvas, and any chart or legend that follows. Studio's import of it
is commented out until the `@invana/styling` 0.0.21 bump; until then the slots
resolve to `--color-muted-foreground`, so the dots are neutral rather than
absent.
