---
"studio": patch
---

Upgrade the design-kit family to `0.0.22` (`@invana/ui`, `@invana/forms`,
`@invana/styling`, `@invana/themes`).

Two panel-header APIs changed, and every Studio call site moved with them:

- `TabbedPanel`'s `headerActions` is now the `NavHorizontal` item list itself
  rather than a slot object. The `{ rightNavItems: [...] }` wrapper is gone (the
  tabs already own the left, so a header has one action area), and so is the
  `{ right: <node/> }` escape hatch — the Settings panel's maximize and close
  controls are now nav items instead of hand-rolled ghost `Button`s.
- `PanelStackSection` drops `actions` for `headerActions`, the same item list, and
  those items stay hidden until the header is hovered or focused. The Explorer's
  type panel used `actions` for **counts**, not actions, so its three section
  counts move into `title` — where the kit puts chrome that must always read — via
  a `sectionTitle()` helper that repeats the kit's default header typography.
