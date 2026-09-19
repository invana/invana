---
"invana": patch
---

Design-kit 0.0.27.

`@invana/ui`, `@invana/forms`, `@invana/styling` and `@invana/themes` move from 0.0.26 to 0.0.27.
The canvas family stays at 0.0.12 — a different repo.

No API moved, and no call site changes with it. What 0.0.27 carries is one new package,
`@invana/dashboard`: a dashboard is a document, and the six Tasks surfaces are six of them. Studio
does not depend on it yet, so the bump buys the option, not a change.

`pnpm peers check` still reports `@invana/themes@0.0.23` as an unmet peer — a stale transitive copy
pulled in through the canvas family, unchanged by this bump. The `@invana/forms@0.0.26` peer
complaint it used to sit beside is gone, because forms moves with the rest.

`tsc -b --noEmit`, `pnpm build` and `biome check` are all clean before and after.
