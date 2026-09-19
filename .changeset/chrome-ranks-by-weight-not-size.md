---
"studio": patch
---

Chrome ranks by weight, not by size (docs/for-developers/building-studio/the-shell.md).

**A panel header was smaller than the section headers inside it.** `ListPanelChrome` wrapped every
panel title in `text-xs font-normal`, so the title read 12px regular while a `PanelStack` section
header under it read 12px semibold uppercase — caps carry more visual height than lowercase, so the
divider out-shouted the thing it divided. The wrapper now declares no size and is `font-semibold`:
the panel title inherits base and outranks its own sections.

**Both breadcrumb rows are one treatment.** The app header trail and each panel's trail are
`font-semibold` throughout, muted, with the current segment at full contrast — they separate by
colour, not by weight. The per-panel `text-xs` override is gone from all seven panels, and
`BreadcrumbPage` restates `font-semibold` because the kit hard-codes `font-normal` on it.

**The ladder is written down.** *The chrome type ladder* in `the-shell.md` states the rung, size,
weight and colour for each level of chrome, and the rule that new chrome never declares `text-xs`.
