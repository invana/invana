---
"studio": patch
---

Modeller: stop the canvas nudging the layout wider when the right panel collapses.

The schema canvas container now clips overflow (`overflow-hidden`), matching the Explorer. Without it, the PixiJS canvas — which rounds its element size up as it `autoResize`s — overflowed by a pixel and shifted the layout slightly wider each time the right Details panel was collapsed.
