---
"studio": minor
---

The Model panel is a stack of drawers, not a scroll of sections (model-editor.md ME13–ME16).

**Every header stays on screen.** `ModelDetail` was one `overflow-y-auto` column of six `PanelSection`s, so a thirty-type model buried Edge types, Links, Keys and Staged below one shared fold. It is a `PanelStack` now: Node types · Edge types · Selected type · Links · Keys · Staged, each collapsing to its own header, the open ones sharing the column with draggable dividers.

**The list and the detail stay two views, and the crumb is the seam.** The panel shows the model list until one is picked, then that model's drawers — one thing on screen at a time, each getting the whole column. `Models › Observations` sits on the detail's first row and **`Models` is a button**: the breadcrumb is the way back, which is what a breadcrumb is for, and it replaces the `← Models` text step.

**`PanelCrumbs` gains navigable crumbs** — a trail entry may be `{ label, onTo }`. It stays inert inside a `TabbedPanel` tab label, where the tab is already a button and a crumb button would be the nested-interactive trap; the tab now says only `Model`, and the navigable trail lives in the body's own header row beside the version readout.

**Node types and Edge types arrive open; the rest arrive closed.** They are the two lists the panel exists for and the two the hi-fi draws. Six open drawers in a 300px rail give each one two visible rows, which is the fold problem in a new shape.

**Every drawer is always present.** A section with nothing in it says so in its body rather than disappearing — `Staged 0`, *Select a type on the canvas*. A stack whose sections come and go re-lays-out under the reader and discards the sizes they dragged. Nothing re-opens a drawer because its contents arrived, either: selecting a type on the canvas fills the Selected type body and leaves the drawer as the reader left it.

**The count moved into the header.** `PanelStack` keeps `headerActions` quiet until hover, and a count has to read while a drawer is *closed* — so it rides `title` as a `Badge` (`shared/SectionTitle`), and `+ add` becomes the hover-revealed header action.

**Links' `add ▾` is now the header's own menu.** Anchor-or-relationship was a hand-built `DropdownMenu`; `headerActions` takes `menuItems` natively, so the markup goes and ST11 reads the way it was always written.

**`stitch/useLinksSection`** replaces `stitch/LinksSection`: a `PanelStack` section is data, not an element, so stitch returns `{ section, dialog }` and the model places both. The seam stays one-way, `model → stitch`.

`AddButton` and `TypeDetail`'s `PanelSection` wrapper are gone. `check-types`, `lint` and `build` are green; not yet rendered in a browser.
