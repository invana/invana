---
"studio": minor
---

`PanelChrome` is deleted — the parallel component layer, minus one file (design-kit-coverage.md §6a).

**510 lines, 14 exports, ~92 call sites across 10 panels.** It predated `@invana/design-kit` and had been sentenced twice — `code-shape.md` §1 row 2 and the coverage map's `A1`. Every piece now draws with a kit primitive or not at all; no hand-rolled chrome markup survives.

**Three vanish outright.** `FieldPill` had zero call sites and a dead re-export in `AgentDetail`. `FilterChipRow` *was* `FilterBar summary={…}` and is inlined as such. `ToggleChip` *was* `FilterChip` with a pressed state, and is now that, with `aria-pressed` it did not have before.

**Seven become compositions in `src/ui/`** — the folder code-shape §4 reserves for what the kit cannot own yet, each carrying a note saying so. `PanelCrumbs` gains something on the way: its last step is a `BreadcrumbPage`, so it carries `aria-current`, which the hand-drawn chevrons never did.

**One stays.** `PolicyFlag`'s tri-state — set / denied / *inherited from the graph* — is an Invana agent-policy rule, not a markup shape (DS2).

**Four kit gaps the deletion surfaced**, now written down rather than worked around silently:

- `Toolbar` is a **stub** — `React.FC` with no props, rendering a hardcoded lock button, `Docs` and `Source`. It cannot hold a panel's actions.
- `Tabs size="sm"` draws its active tab as a **pill**; `PanelTab` is deliberately an underline, and the kit's own `TabbedPanel` underlines too — so the kit disagrees with itself.
- `AgentChip` is a `<span>`, so a clickable principal needs a real `<button>` around it or the keyboard cannot reach it.
- `FilterChip` has no options, so a chip that selects still needs a native `<select>` laid over it.

Closing any of them retires the matching `src/ui/` file. `check-types`, `lint` and `build` are green; no panel has been rendered in a browser.

---

**A rail is a `PanelContent`, not a one-tab `TabbedPanel`.** `ListPanelChrome` drew all eleven left rails as a tab strip holding a single permanent tab — a tab you cannot leave is not a tab. The two components are different shapes, and that difference is why three of the Studio components existed: `TabbedPanel`'s body is `h-[calc(100% - 30px)]` with the footer stacked below it, so a real footer overflows; `PanelContent` is a flex column where `footerContent` holds its height. `tab={{ value, label, icon }}` becomes `title` + `icon`.

**`PanelCrumbs` and `PanelTabs` are deleted with it.** The kit's `Breadcrumb` is inlined at all 7 crumb sites — its last step is a `BreadcrumbPage`, so it carries `aria-current` the hand-rolled trail never had. The tab restyle is gone: `Tabs size="sm"` with the kit's own `TabsList`/`TabsTrigger`, conceding Studio's underline to the kit's pill, because DS1 says the kit is the only component layer.

**The Model panel's crumb moved back to the header**, where it was asked for. `PanelContent`'s title is a `<span>`, so `Models ›` can be a link; inside a tab label it could not have been without nesting one interactive element in another.

**`PanelActionBar` is deleted too — the kit already had the band.** `CardFooter` is `flex items-center p-3`, and `PanelContent` adds `shrink-0 border-t`; that is exactly what the action row's own `div` was drawing. So a panel's footer is `CardFooter` + `Button`, inlined at all 8 sites, and gap G1 closes by not needing `Toolbar` at all — which is just as well, since it is still a stub.

What the component was carrying beyond markup was **order by role** — primary, then outlines, then anything trailing after a spacer. That is a convention, not a component; each footer now spells it out, and the `<span className="flex-1" />` before `Delete` / `Archive` / `Retire…` is what says so.

**Two regressions the first browser run caught, fixed here.** `AppStatusBar` puts everything it is given inside a single `min-w-0 flex-1 truncate` span, so its own `gap-2` never reaches the fragments handed to it — every panel's status line read `Tasks2 running1 in review`. The group carries its own row and its own gap now. And six actions do not fit a 460px rail: the Model panel's footer clipped `Delete` at the panel edge, so a footer wraps rather than clips.
