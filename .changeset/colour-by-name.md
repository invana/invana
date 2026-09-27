---
"invana": patch
---

Every node type, relationship type and model has a default colour, chosen from its name (GC4 · GM7 · ST17).

Relationships in the Explorer used to share one grey while their dots in the Types panel were
coloured; each relationship type is now drawn in its own colour, matching its dot. A model's hue
comes from its name instead of its position in the list, so it no longer changes when another
model is added, deleted or re-sorted. One function, `@invana/styling/color`'s `colorByString`,
chooses all three.

In the modeller, each node type now wears its own colour, the same one the Explorer paints it,
and the model's colour is on the frame around it.
