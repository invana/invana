---
"studio": patch
---

The graph left rail (Explorer / Modeller) is now one single-open accordion. The
top view panels (Explorer's SessionsPanel, Modeller's SchemaNav) are keyed into
the **same** `?settings` param and toggle as the bottom settings icons — their
keys are just `sessions` / `schema`. Clicking any icon opens its panel (and
closes whatever else was open); clicking the open icon closes it. Because one
param backs the whole rail, two panels can no longer be open or highlighted at
once.

The previous separate `?sessions` / `?models` panel params are gone. As a result
the view panels now default closed on landing (like every other rail panel) and
open on click. The right-side Inspector / Detail panels are unchanged.
