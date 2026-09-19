---
"studio": patch
---

Step 1 of rebuilding the Explorer's main region as a page host: `DataBoardPage`
now owns one canvas.

The main region is a four-branch ternary — model canvas, work canvas, session
canvas, or the reason there is none — and only one branch is ever alive. Those
are four kinds of *page* fighting over one slot. `DataBoardPage` is the first kind
lifted out of the ternary: a session's canvas with its tab strip, its overlays
and the dialogs that act on it.

Five pieces of state move down with it, because each is about that canvas and
nothing else: `stylingOpen`, `historyOpen`, `tutorialOpen`, the tab being
renamed, and the vertex being fine-tuned. Two callers reached up for a setter
and no longer need to — a fork closes the history panel from inside the page,
and `onOpenFineTune` is supplied by the page that owns the panel rather than
by the caller that does not.

`ExplorerPage` 2,245 → 2,188 lines. The rest of the reduction is the next
step: `canvasData`, `seedData`, `styling` and `selectedId` are still held above
because the inspector is a shell region and reads them. Moving those down means
each page publishes its contents and selection upward when active — the same
pattern the lifted `CanvasContext` already uses — and that is what turns this
from one instance into one per open canvas.

No behaviour change. Verified in the browser: the canvas, its tab strip, the
camera toolbar and the styling overlay all render and work as before.
