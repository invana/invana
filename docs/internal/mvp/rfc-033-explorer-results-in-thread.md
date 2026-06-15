# RFC-033: Explorer results in the session thread — preview, windowing, load-to-canvas

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-15
**Related**:
- **RFC-024** (Query Sessions) — messages are **metadata-only**; results aren't persisted. This RFC keeps
  that — results stay transient (held in the page, re-fetched by re-run), it only changes *where* they
  render.
- **RFC-030** (Explorer NL) — the trigger: an NL `count(n)` reply showed only *"Returned 1 row"* with the
  actual row nowhere visible. This RFC makes the answer visible in the thread.
- **RFC-025 / RFC-026** (Studio telemetry / session tracing) — the run vs. canvas-render spans are
  decoupled by this change (a query run no longer auto-paints), so the canvas pipeline spans now fire on
  **Load to canvas**, not on every run.

---

## Problem / intent

Today the Explorer paints **graph** results onto the canvas and **drops tabular** results entirely —
`paintCanvas` early-returns for anything non-graph, so a `RETURN count(n)` answer is invisible except for
the assistant's *"Returned 1 row"* summary. The data is in the response (`result.rows`), it just has no
home. And graph results **auto-paint**, which couples "ask a question" to "redraw the canvas" whether or
not the user wanted to project.

**Intent:** make the **session thread the home for results** — each answer renders its data inline (a
**preview table** for tabular, a **summary + "Load to canvas"** for graph) — and project to the canvas
only on explicit request. Large results render a **windowed preview** so the DOM never holds the whole
set. Entirely Studio; no engine change.

---

## Decisions

1. **Results render inline in the thread, under their assistant message.** A tabular reply renders a
   preview **table**; a graph reply renders a **summary card** (`N nodes · M edges`) with a **Load to
   canvas** button. The backend's short `content` ("Returned 1 row") stays as the one-line summary; the
   inline block is the data.

2. **Results stay transient, keyed by message id (RFC-024 unchanged).** The page holds a
   `Record<messageId, QueryResponse | null>`, populated by **send** and **re-run** — not persisted.
   `send` now surfaces the **assistant message id** so its result can be keyed. Reopening a session
   re-runs the latest `source_query`-bearing message (existing restore effect) → its result repopulates
   inline. Older messages the user hasn't run this session show metadata + the existing **re-run** button;
   clicking it fetches and shows their result inline. (No snapshotting results into the DB.)

3. **Graph data is projected explicitly — no auto-paint.** A query run no longer paints the canvas;
   `paintCanvas` is invoked only by **Load to canvas** on a graph result block. This makes the thread the
   results home and the canvas a deliberate projection. (Resolves the user fork: *Summary + Load to
   canvas*.)

4. **Tabular previews use client-side render-windowing.** The API returns the rows once; the inline table
   renders the first `PAGE` rows (default 10) and a **Load more** button reveals the next `PAGE` from the
   already-fetched array. Only rendered rows hit the DOM, so a 10k-row result doesn't bloat the thread.
   **No server pagination** — paging arbitrary user queries (counts, projections, paths) generically is a
   separate, harder effort (deferred; see Out of scope).

5. **Telemetry: run and canvas-render decouple.** `runTraced` traces the query run and closes its span in
   `finally` (a run produces no canvas frame now). **Load to canvas** opens its own `explorer.query.run`
   span (`explorer.trigger: "load"`) and the existing canvas bridge closes it after the painted frame —
   so the `explorer.transform/adapt/layout/render` stages (RFC-025) now attribute to the load action, not
   the run. The engine-side `query.execute` trace is unchanged.

6. **The canvas-overlay table (prior iteration) is removed.** Last iteration showed tabular results as an
   overlay on the canvas; this RFC supersedes it — results live in the thread. `ResultsTable` becomes the
   inline windowed table; the overlay usage in `ExplorerPage` is deleted.

---

## Design

### Data flow

```
send(payload)            → { sessionId, messageId, result }   # messageId = assistant message id (new)
rerun(messageId)         → result
ExplorerPage.resultsByMessageId[messageId] = result           # transient, per-message
SessionsPanel thread     → AssistantMessage renders <ResultBlock result={results[message.id]} .../>
  result_type "tabular"  → <ResultsTable rows> (preview PAGE rows + "Load more")
  result_type "graph"    → summary "N nodes · M edges" + [Load to canvas] → ExplorerPage.paintCanvas
```

### Components (Studio)

- **`ResultsTable`** (repurposed): inline, windowed. Props `{ rows }`. Local `visible` count (start
  `PAGE`); renders `rows.slice(0, visible)` in a `@invana/ui` `Table` inside a height-capped `ScrollArea`;
  a **Load more** button (`+PAGE`, shows remaining) when `rows.length > visible`. No overlay chrome.
- **`ResultBlock`** (new): dispatches on `result.result_type` — `tabular` → `ResultsTable`; `graph` →
  summary line (`data.nodes.length` · `data.edges.length`) + **Load to canvas** `Button` calling
  `onLoadToCanvas(result)`. Renders nothing for `null` / empty.
- **`AssistantMessage`** (SessionsPanel): gains `result?` + `onLoadToCanvas`; renders `<ResultBlock>`
  under the meta row (keeps the `</>` view-query disclosure + re-run + copy).
- **`ExplorerPage`**: `resultsByMessageId` state; `runTraced` returns the result (no paint); `handleRun` /
  `handleRerun` store it by message id; `handleLoadToCanvas` paints; passes `results` + `onLoadToCanvas`
  through `SessionsPanel` → `SessionThread` → `AssistantMessage`.
- **`useSessions`**: `send` returns the assistant `messageId` (read off `sendMessage`'s response).

### No engine / storage change

The engine already returns `result_type`, `rows`, `data`. No migration, no new route, no schema change.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| **Canvas-overlay table (prior iteration)** | Reuses the canvas area | Data lives away from the conversation; one result at a time; not where the user reads the thread | Superseded (Decision 1/6) — results belong in the thread. |
| **Auto-paint graph results (status quo)** | Zero clicks to see the graph | Couples ask→redraw; clobbers the canvas on every tabular-or-graph run; user wanted explicit projection | Rejected (Decision 3) — Load to canvas is explicit. |
| **Server-side pagination (LIMIT/OFFSET)** | Network never carries the full set | Can't page arbitrary `RETURN` shapes generically; needs query rewriting + a cursor protocol | Deferred (Decision 4) — render-windowing covers the DOM/perf concern now. |
| **Persist results on the message** | Past results visible without re-run | Bloats `session_messages` with graph/row snapshots; stale vs live DB; breaks RFC-024 Decision 3 | Rejected (Decision 2) — transient + re-run, as RFC-024 intends. |

## Security / Performance

- **Performance**: windowing bounds the DOM to `visible` rows regardless of result size; the height-capped
  `ScrollArea` bounds layout cost. Graph results don't touch the canvas until Load to canvas, so a large
  graph never auto-renders.
- **Security**: unchanged — results were already returned to this client; this only changes rendering. No
  new data leaves the browser.

## Open Questions / Out of scope

- [ ] **Server-side pagination / streaming** for very large results — deferred (Decision 4).
- [ ] **Few-shot grounding** so prompts like *"nodes and edges"* yield both counts — tracked in RFC-030's
  open questions (a translation-quality lever, separate from this rendering change).
- [ ] **Column typing / formatting** (numbers, dates, links) in the preview table — v1 stringifies cells;
  richer cell rendering is a later polish.

## Implementation Plan

1. [ ] `ResultsTable` → inline windowed table (preview `PAGE` + Load more).
2. [ ] `ResultBlock` → dispatch tabular/graph (+ Load to canvas).
3. [ ] `useSessions.send` → surface the assistant `messageId`.
4. [ ] `ExplorerPage` → `resultsByMessageId`; `runTraced` returns result (no paint); store on run/rerun;
       `handleLoadToCanvas`; remove the canvas overlay + `tabularRows`; pass `results`/`onLoadToCanvas`.
5. [ ] `SessionsPanel` → thread passes `result` + `onLoadToCanvas` to `AssistantMessage`, which renders
       `<ResultBlock>`.
6. [ ] Changeset (user-facing: results render in the thread; graph loads to canvas on click).

## Scope & MVP impact

A Studio-only refinement of the Explorer results surface (§ 5.5 / § 5.7). No new MVP scope line needed
beyond a note under § 5.5 that Explorer results render in the session thread with Load-to-canvas; no
engine/backend change. Server pagination + few-shot grounding remain separate future items.

## References

- `studio/src/pages/graphs/explorer/ExplorerPage.tsx` — `paintCanvas` / `runTraced` (the run→render path).
- `studio/src/pages/graphs/explorer/components/SessionsPanel.tsx` — `SessionThread` / `AssistantMessage`.
- `docs/internal/mvp/rfc-024-query-sessions.md` — metadata-only results (Decision 3) this preserves.
