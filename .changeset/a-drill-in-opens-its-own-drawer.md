---
"invana": patch
---

A drill-in opens its own drawer.

The Tasks and Projects panels are stacks, and `?drawer=` named the drawer the column *opened* on —
`PanelStack` reads `defaultSize` at mount, so that was the whole of it. Everything after mount
belonged to whoever dragged the dividers, which is right for a size and wrong for a drill-in: open
a run from the canvas into a Runs drawer the reader collapsed ten minutes ago and the detail
renders into a shut section. Nothing appears on screen, and the click reads as broken.

The stack now takes `stackRef` (`@invana/ui@0.0.26`) and the focused drawer is expanded on a
drill-in. It fires when the focus moves **or when the drilled-into id changes**, because arriving
at a run from somewhere else leaves `?drawer=runs` exactly where it was and moves only `&run=` —
watching the focus alone would miss the case the wiring exists for.

It opens the drawer; it never re-asserts a size. The reader's column shape survives, which is the
same split `PanelStack` itself makes: the resizable group owns the geometry, and the consumer only
asks for a section to be open.
