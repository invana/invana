---
"studio": patch
---

`GraphDetail` drives `AppLayoutV2`'s regions instead of building its own split
(DS12). It had 90 lines of `ResizablePanelGroup` and a comment explaining that
the shell's `leftSection ? <Group> : <div>` ternary swapped the element type at
main's parent position, remounting the canvas on every panel toggle. `@invana/themes`
0.0.23 fixed that — main is always wrapped in the same group with stable ids, and
each side region is a conditional sibling — so the workaround now protects against
a bug that no longer exists.

`AppLayoutV1` → `AppLayoutV2`, `leftSection` / `mainSection` / `rightSection` as
props, and `idPrefix="graph-detail"` because the Explorer nests a canvas app inside
main and the e2e specs locate panels by id.

Verified in the browser rather than by inspection, since the property at stake is a
runtime one: with the canvas at 120% zoom and pan 386,452, switching the left panel
from Explorer to Model and then closing the right drawer leaves both unchanged. The
canvas does not remount.
