---
"studio": patch
---

The Explorer panel closes.

It was the left column's resting state, so closing it re-rendered it: `close()` dropped
`?panel`, and with no key open the shell fell back to the page's own `leftSection`, whose
content chain ended at `ExplorerTypesPanel`. The rail's Explorer icon had the same problem
from the other side — it *was* `close()`, so it could never be a toggle.

The panel is now `?panel=explorer`, a key like Model or Datasets: the rail icon toggles it,
the panel's own close control closes it, and with no key open there is no left column at all
(selection-and-the-panel.md SP10). `leftSectionIsDefault` is gone from `GraphDetail`, so a
`?panel` value the page draws nothing for gives the width back to the canvas.
