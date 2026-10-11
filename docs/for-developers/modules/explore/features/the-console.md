# The console

The rows under the drawing. What the canvas drew came from records and a query; the console is where
both are readable without leaving the canvas that drew them.

| | |
|---|---|
| Index | [4.5](../../../README.md#4--explore) · Slice **S12f** |
| Module | [Explore](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [graph-canvas](graph-canvas.md) · [selection-and-the-panel](selection-and-the-panel.md) · [the-answer-surface](../../ask/features/the-answer-surface.md) · [write-queries](../../ask/features/write-queries.md) |

> **As** someone looking at a canvas, **I want** the records and the query behind what it drew, **so
> that** I can read the rows without losing the picture they made.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C1 | Records | The rows behind what is drawn, in a compact table |
| C2 | Query | The query that produced them, verbatim and read-only |
| C3 | It spans the canvas only | The left panel and the inspector stay full height — both describe the selection, which the console does not change |
| C4 | It collapses, and stays collapsed | Its own param, so opening it never costs the left panel or the right side ([E8](../spec.md)) |
| C5 | It follows the canvas tab | Switching canvas switches what the console holds |
| C6 | The context bar is its last row | The counts for the surface in front of you, and the shortcut that finishes it |
| C7 | Log | What the last run did, step by step, with the failing step's error — where a failed query is read |
| C8 | Table or JSON | The same records, as a table or as the JSON they arrived in |
| C9 | Re-run | Runs the query again as a new run of the same reply |

## Journey

```mermaid
flowchart TD
    A[Something draws on the canvas] --> B{Where did it come from?}
    B -->|a typed query| C[Console holds that query and its rows]
    B -->|an answer| D[Console holds the emission's records<br/>and the query the run ran]
    B -->|a restored canvas| E[Console holds nothing<br/>and says the canvas was restored, not run]
    C --> F[Open the console]
    D --> F
    E --> F
    F --> G[Records · read the rows]
    F --> H[Query · read what ran]
    G --> I[Select a row → the canvas selects that element]
    F --> J[Collapse]
    J --> K[Stays collapsed across navigation and reload]
```

## Seams

| Seam | What the user sees |
|---|---|
| Nothing has run | The console names what would fill it — a query, or an answer — not an empty grid |
| A query returned no rows | `0 records`, and the query still readable. Nothing to cite reads as a fact, never as a failure |
| Too many rows to hold | The count is stated in full; the table is windowed, and says so |
| A run still streaming | Rows land as they arrive; the count is provisional and marked as such |
| The canvas was restored from a version | No query to show — the console says the canvas was restored, and what it was restored from |
| Reload | Whether the console is open survives; the rows come back from the emission, not from a re-run |
| Console open, no canvas | The console closes with the canvas — it describes a drawing, and there is none |
| A query failed | The console opens on Log: the failing step and its error. Records says nothing ran |

## Surfaces

| Surface | Shape |
|---|---|
| Region | `AppLayoutV2` `bottomSection`, `bottomSpan: "main"` — under the canvas, beside nothing |
| Tabs | `TabbedPanel` — Records · Query · Log; `headerContent` holds Table/JSON (`SegmentedControl`, Records only); `headerActions` hold Re-run and Collapse. Re-run is disabled while a run is in flight or when the reply has no query to run |
| Records | `Table`; a graph's records are its nodes and relationships, one row each, and a row selects its element on the canvas. A cell is capped and truncated, with the whole value as its hover |
| Query | Read-only `TypographyPre` per query the reply ran, with its position, language and time above it. Records as JSON is a `TypographyPre` too. Editing a query is [3.1](../../ask/features/write-queries.md)'s surface, not this one |
| Log | A `Terminal` of `TerminalLine`s, one per step of the reply's run — time, level, source, message, in aligned columns — then the error of a failed step |
| Context bar | `ContextBar` as the console's own last row — counters only. The console has no editor, so it names no key; `⌘↵` is the composer's |
| Toggle | A `Console` action in the Workbook strip of a data canvas; the console's own Collapse hides it again |
| Param | `?console=records \| query \| log` — open, on that tab. Absent is collapsed. Independent of `?panel=` and `?right=`, and written through `useUpdateSearchParams` (`@invana-studio/core`) like `?right=`, so a write a beat after the other's keeps both |
| Code | `studio/packages/assistant/src/console/` — `ConsolePanel`, `useConsoleParam`, `consoleRecords` |

## Engine

| Thing | Shape |
|---|---|
| Routes | None new. Records come from the result already in hand, and after a reload from the emission ([3.3](../../ask/features/the-answer-surface.md)) |
| Query text | The `query` step of the run, or the query the person typed — the same string either way |
| Persistence | Client-side, in the URL. The rows are not a stored artefact of the canvas |

## Decisions

| # | Decision |
|---|---|
| CO1 | The console spans the **canvas only**. The panel and the inspector describe the selection; the console describes the draw, and a region that changes neither must not shorten both. |
| CO2 | Query is **read-only**. A second editable query surface would be a second place a query can be written, and the two would disagree about which one ran. |
| CO3 | A **third axis, a third param**. `?console=` moves independently of `?panel=` and `?right=`, for the reason E8 gives: regions that can be open at the same time were never peers. |
| CO4 | The `ContextBar` belongs to the **console**, not the page. It counts what the console holds, so it disappears with it rather than outliving the thing it counts. |
| CO6 | The console holds **the open thread's latest reply** — the canvas is the thread's 1:1 layer, so this is C5. Its records are the reply's persisted emissions, falling back to the result in hand, so a reload reads the record rather than re-running. |
| CO7 | **Log is the third tab, not a toast.** A failed query opens the console on it ([AD25](../../ask/features/the-assistant.md#decisions)); it lists the run's steps from the reply, so it needs no route. |
| CO8 | **Collapsed is the param's absence.** One value per open tab and none for collapsed, so a reload, a panel switch and a new tab all keep it. |
| CO5 | Selecting a row **selects on the canvas**. It is the same selection object ([E3](../spec.md)) — a table row and a drawn node are two views of one record, never two selections. |

## Not building

| Not built | Because |
|---|---|
| An editable query box | [Write queries](../../ask/features/write-queries.md) owns authoring. The console shows what ran |
| Row export | Answers are records ([3.3](../../ask/features/the-answer-surface.md)); export belongs to the emission, not to a strip under a canvas |
| A REPL or terminal | Nothing here is a shell. The `Terminal` component exists for the CLI's own screens |
| A third tab per canvas kind | Records and query are true of every kind. A kind-specific tab would make the console six consoles |
| Sorting and filtering the table | The order is the order the query returned. A grid that re-sorts silently disagrees with the query above it |
