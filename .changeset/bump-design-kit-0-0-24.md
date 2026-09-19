---
"studio": patch
---

Upgrade the design-kit family to `0.0.24` (`@invana/ui`, `@invana/forms`,
`@invana/styling`, `@invana/themes`).

No API moved. `0.0.24` carries three changes: `NavItems` becomes one strip
renderer that folds overflow and owns tab semantics, `TimelineList` gains a rail
variant and a footer, and `ThemeProvider` merges partial selections when it
persists theme state.

`TreeView` and `PanelStack` are unchanged, so neither of the open Model-panel
questions moves: a tree navigator still needs `TreeView` to gain a fill variant,
a selected state, row actions and counts, and a drawer that folds on selection
still has no controlled collapse to fold it with.

`pnpm peers check` now reports `@invana/themes@0.0.23` as an unmet peer.
`@invana/canvas-react@0.0.12` depends on `^0.0.23`, and for a `0.0.x` version a
caret pins the patch — so it holds a second copy rather than floating to
`0.0.24`. It is inert: that package's built output imports `@invana/canvas`,
`@invana/canvas-store`, `@invana/graph*`, `@invana/renderer-pixijs`,
`lucide-react` and `react`, and never `@invana/themes`. `@invana/ui` stays a
single copy, because `canvas-ui` takes it as a `*` peer. The fix, when the canvas
repo is next touched, is to make its `themes` dependency a peer the way
`canvas-ui` already does.

`check-types`, `lint` and `build` are green.
