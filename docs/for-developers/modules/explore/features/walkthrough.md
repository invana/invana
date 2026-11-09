# Walk through an answer

A session's answers, replayed on the board one step at a time — each step the reply that drew it,
highlighted on the canvas and in the thread.

| | |
|---|---|
| Index | [4.6](../../../README.md#4--explore) · Slice **—** (not scheduled) |
| Module | [Explore](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Related | [graph-canvas](graph-canvas.md) · [boards](boards.md) · [share-an-answer](share-an-answer.md) · [the-answer-surface](../../ask/features/the-answer-surface.md) |

Product spec: [EX-F02 · Share and present an answer](../../../../../specs/capabilities/explore/features/EX-F02-share-and-present-an-answer/feature.md) — the story, its criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Present | The toolbar's last group ([GC21](graph-canvas.md#decisions)): one labelled *Present* button, only with two or more steps |
| Presenting toolbar | The same toolbar, collapsed to `◀ n/N ▶ ✕`. A compact `PlaybookStepper` in `@invana/canvas-ui` — **owed**, with a story |
| Presenter bar | Bottom-centre in the space right of the bottom-left dock, 540 px wide, only while presenting: the question as the user's bubble (or *Expanded LHR* · *Your changes* with their icon), the assistant's message beside its avatar, one dot per step. No buttons — ◀ ▶ ✕ are the toolbar's. `PlaybookPresenterBar` (`@invana/canvas-ui`) grows a compact variant for this; its labelled Previous / Next go, not to a Studio override |
| Thread mark | The current step's reply has a `--primary` rail on its left edge and is scrolled into view |
| Step chip | `Step n` on the reply's meta line, left of `N records` ([AS16](../../ask/features/the-answer-surface.md#decisions)) |
| Your changes line | A thin rule across the thread between the two replies it falls between — *Your changes · layout, hid 2 nodes, moved 3* — with its `Step n` chip |
| Canvas | [Invana Products](https://claude.ai/artifact/HcPfkMUYUtEbRaZFaYnHtg) › Explorer — EX-17 (`explorer.present*`) |
| Presenting | The toolbar folds to the stepper; Layers · Styling · History close; the legend, the zoom bar and the minimap stay ([GC24](graph-canvas.md#decisions)) |

## Engine

| Thing | Shape |
|---|---|
| Step | The canvas's `StepSpec`: `id` · `title` · `narration` · `data` (the delta the reply drew) · `view.focus` (its elements; the rest dimmed) · `view.camera` (the framing when it settled) · `meta.reply_id` |
| Stored | The board document carries `walkthrough: PlaybookSpec`, written with the board's autosave and versioned with it (CV2) |
| Route | None new: the walkthrough reads and writes with the board (`…/boards/{id}`) |

## Decisions

| # | Decision |
|---|---|
| WT1 | **The product word is Walkthrough.** *Playbook* already names a Skill ([terminology](../../../terminology.md)). `playbook` stays the canvas package's own word for the mechanism, the way `exportState` stays the renderer's (CV11). |
| WT7 | **Hand edits between two replies are one step.** Expand-free edits — layout, hide, style, move — made since the last step become one *Your changes* step. It is appended when the next reply arrives or presenting starts, through `history.sinceLastStep`, so the work is adopted rather than replayed. |

## Not building

| Not building | Because |
|---|---|
| Animating a force settle between steps | [GC8](graph-canvas.md#decisions) — the camera moves; nodes glide only when a step changes the preset |
