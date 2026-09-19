---
"studio": minor
---

Layers moved out of the left column and onto the canvas. It is the fourth
control on the page strip — Help · **Layers** · Styling · History — and opens as
a card floating over the canvas's top-right corner instead of docking a panel
beside it. The `Layers` rail icon and the `?panel=layers` key are gone; a stale
`?panel=layers` link lands on the Explorer's type list.

The three corner cards are now one at a time: opening Layers closes Styling or
History, and the other way round, since all three pin to the same corner. The
card itself is canvas-ui's `Panel` + `PanelContent`, and it is mounted only while
open — a closed Layers no longer subscribes to the canvas store.

Nothing about the tree changed: layers top-first, the Graph layer grouped by
node/edge type with live counts, the visibility eye, and the right-click
Focus · Select · Hide/Show menu all behave as before.
