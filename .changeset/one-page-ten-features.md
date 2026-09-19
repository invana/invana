---
"studio": patch
---

One graph-scoped page, ten feature folders, and `mainSection` as a page host.

**`GraphDetailPage`.** `ExplorerPage` was never the Explorer — it rendered Agents, Projects,
Tasks, Skills, Workflows, Model, Links, Datasets, Templates, the canvas and the assistant from
one 2,247-line component. It is now `GraphDetailPage`, and the ten things it hosts live in
`pages/graphs-detail/features/` — `connect-and-model` · `bring-data-in` · `ask` · `explore` ·
`agents` · `skills` · `workflows` · `work` · `operate` · `graph-settings` — with the shell
(`useGraphLeftNav`, `useSettingsPanel`, `ConnectionStatusBar`, `GraphHomePage`) beside them in
`shell/`. 103 files moved; the contract they moved to is
`docs/for-developers/building-studio/graph-detail-page.md`.

The `@/` alias was registered in Vite and tsconfig but used **zero** times against 310 deep
relative imports, so every import went onto it first — which is what made the moves free.

**`mainSection` is `BoardPagesViewPanel`.** It was a four-branch ternary over one slot, and
only one branch could be alive: opening a model unmounted the Explorer canvas entirely. It is
now a page list — the graph page, one page per open canvas, the model, and whichever work
canvas a panel drove. `CanvasTabsBar` (269 lines) is deleted; the kit's strip owns the tabs and
their bodies together, so the two cannot drift.

`keepMounted` is explicitly `false`, which reproduces the old behaviour exactly — only the
active body mounts, as the ternary did. Turning it on is unsafe until each canvas page owns its
own engine instead of sharing one `useCanvasStates`, and that is the next step.

`DataBoardPage` stopped owning a strip. It exposes a `BoardPageHandle` —
`openHelp` · `toggleStyling` · `toggleHistory` · `openRename` — because `BoardHeaderAction`
carries no page id, so the shell holds the handle and calls into the active page. A model page
therefore never offers *Find in canvas*.

**The graph page.** With nothing open, `mainSection` used to be a sentence explaining why it was
empty. It is now a page that cannot be closed, naming the graph, its connection state, its
connector and its members — which is also where the six `leftNav` items that open no page
(Skills, Templates, Events, Settings, Links, Layers) now land.

**An Explorer item on `leftNav`.** The first icon, and the only one that opens no panel: with no
rail key open the left column is already the Explorer's own type list, so the item closes
whatever is covering it and is lit exactly when nothing else is. Before this there was no
positive way back to the type list — you had to click the open panel's icon a second time.

**One status vocabulary.** There were three `StatusDot` implementations and five tone unions
disagreeing about what colour a failed task is. `statusTone.Tone` is now the kit's
`StatusDotProps["tone"]`, so a resolved status goes to `StatusDot`, `Badge` or the work canvas
with no second mapping table. `DetailStatus` composes `Badge`, `PanelSection` composes
`SectionHeader`, `AgentChipRow` composes `AgentChip`, the chip family composes `FilterBar` /
`FilterChip`, and `PanelChrome`'s `MetricTile` is deleted in favour of the kit's.

Components shadowing a kit export go from **12 to 4**: `ThemeToggle` → `ModeToggle`,
`GraphStatusBar` → `ConnectionStatusBar`, `SettingsSection` → `GraphSettingsSection`,
`DataBoardPage` → `DataBoardPage`, `TableBody` → `TableEmissionBody`. The remaining four —
`EmissionCard`, `CannotAnswerCard`, `DiagnosisCard`, `InspectorPanel` — are rewrites of the
answer surface against the kit's own, not renames, and are left for their own change.

`PanelStatusBar` is **not** among them and stays: `AppStatusBar` is the application bar that
describes the session, and a panel's own footer line describes the panel.

The 25 remaining `text-[10px]` / `[11px]` / `[12px]` sites move to `text-meta`. The ladder has
two content steps and neither is a pixel value.
