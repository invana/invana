# The console

What is drawn, and the queries that drew it. The canvas holds records that queries put there; the
console is where both are readable without leaving the canvas.

| | |
|---|---|
| Index | [4.4](../../../README.md#4--explore) · Slice **S12f** |
| Module | [Explore](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [graph-canvas](graph-canvas.md) · [selection-and-the-panel](selection-and-the-panel.md) · [the-answer-surface](../../ask/features/the-answer-surface.md) · [write-queries](../../ask/features/write-queries.md) · [see-what-ran](../../operate/features/see-what-ran.md) |

Product spec: [EX-F01 · The board and its canvas](../../../../../specs/products/explore/features/EX-F01-the-board-and-its-canvas/feature.md) — the story, its criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Region | `AppLayoutV2` `bottomSection`, `bottomSpan: "main"` — under the canvas, beside nothing |
| Toggle | The footer's left zone: `195 nodes · 312 relationships` opens Data, `4 queries` opens Queries. Each is a link-styled `Button` (`variant="link"`); the open one reads as pressed, and a second click collapses |
| Tabs | `TabbedPanel` — Data · Queries; `headerActions` hold Collapse |
| Data · labels | A list down the console's left, nodes then relationships: label, count. Selecting one fills the table |
| Data · table | `Table` of the selected label, its own columns, 20 rows. `headerContent` holds Table/JSON (`SegmentedControl`) and the pager (`1–20 of 120 ‹ ›`). A cell is capped and truncated, with the whole value as its hover. A row selects its element on the canvas |
| Data · JSON | `TypographyPre` of the same page |
| Queries · list | One row per query step: status glyph · the query, one line · language · when · duration · rows · the question that ran it. Newest first |
| Queries · detail | The run page's step body (`operate.runs.detail.step.*`) — Overview · Touched · Log — fitted to the console, with *All queries* back and Re-run. Re-run is disabled while a run is in flight |
| Param | One value: `?console=data`, `data:<node\|relationship>:<label>:<page>`, `queries`, `queries:<reply id>`. Absent is collapsed. One param, so it never collides with the Workbook's `?page=` or a run page's `&step=`; independent of `?panel=` and `?right=`, written through `useUpdateSearchParams` (`@invana-studio/core`) |
| Code | `studio/packages/assistant/src/console/` — `ConsolePanel`, `useConsoleParam`, `consoleRecords`. The footer's counts are `ConsoleCounts` in `@invana-studio/explorer`; its message, view and renderer sections are canvas-ui's `MessageStatus` · `ViewStatus` · `RendererStatus`; a query's detail is `QueryStepBoard` in `@invana-studio/shell`, which composes the run page's `stepBoardSpec` |

## Engine

| Thing | Shape |
|---|---|
| Data | The canvas's own records — client-side, no route |
| Queries | One per reply that ran a query: its run's `execute_graph_query` step, or the step that failed before it — read from the replies the session already holds; no route |
| Step detail | The run's trace, through the route the run page reads ([see-what-ran](../../operate/features/see-what-ran.md)) — the same record, not a copy |
| Persistence | Client-side, in the URL. Neither tab is a stored artefact |

## Decisions

| # | Decision |
|---|---|
| CO3 | A **third axis, a third param**. `?console=` moves independently of `?panel=` and `?right=`, for the reason E8 gives. |
| CO12 | **Collapsed is the param's absence.** A reload, a panel switch and a new tab all keep it. |
