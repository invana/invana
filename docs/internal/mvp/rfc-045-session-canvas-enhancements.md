# RFC-045: Session canvas enhancements — single sidebar, styling, banner, tutorial

**Status**: Draft
**Author**: Invana Team
**Date**: 2026-07-06
**Related**:
- **RFC-043** (Explorer Canvases) — the model this builds on, **unchanged**: a `Session` (owned by
  graph + user; conversation + query/expand capability) is backed **1:1 by a `Canvas`** (the visual
  layer — snapshot, positions, viewport, filters, settings). This RFC keeps that exactly and only
  **enriches the canvas** (styling, banner) and **simplifies the UI** (one primary list = Sessions).
- **RFC-024** (Query Sessions) — the Session is the primary Explorer entity and the sidebar list.
- **RFC-019** (styling decoupled from schema) — per-canvas styling is the home for visual rules, keyed
  by node/edge **type name** so it survives schema version bumps.

> **Context.** An earlier iteration promoted a "Board" container over many sessions; that was reverted.
> The chosen model is the RFC-043 one — **Session is primary, Canvas is its 1:1 visual layer** — plus
> the four enhancements below. "Canvas" is both the entity (the 1:1 visual-state row) and, loosely, the
> render surface (`@invana/canvas`); they coincide 1:1 so the overload is harmless here.

---

## Problem / intent

The Explorer shows **two** primary lists — Sessions *and* Canvases — for what is a **1:1** pairing, so
the sidebar is redundant. And the canvas, while it persists the painted view, can't yet be **styled**
(color/label/size by type) or show a **preview**. New users also get no orientation on what the
surface can do.

Intent: **one primary list (Sessions)**; each session paints its 1:1 canvas. Enrich the canvas with
**per-type styling** and a **banner screenshot**. Add a one-time **tutorial** explaining what you can
do (query · expand · visualise · interact · run complex logic).

## Decisions

1. **One primary sidebar list: Sessions.** Drop the standalone "Canvases" rail icon + panel. The
   Explorer left rail is **Sessions + Model**. Opening a session paints its 1:1 canvas (unchanged
   auto-create-on-start behaviour). The main-area **canvas tab bar stays** — each open tab is a
   session's canvas.

2. **Per-canvas styling.** New `canvases.styling` JSON — `{ nodeTypes: { <name>: {color, labelProperty,
   size, icon?} }, edgeTypes: { <name>: {color, labelProperty, width?} } }` — edited in the canvas
   toolbar and applied by the renderer. Name-keyed (RFC-019) so it survives schema publishes.

3. **Banner screenshot.** New nullable `canvases.banner` (base64 PNG data URL, ~600px) captured
   client-side from the PixiJS renderer on save, downscaled. Shown as a preview; excluded from the list
   summary (heavy), lazy-fetchable.

4. **Session tutorial.** A `SessionTutorialModal` — query / expand / visualise / interact / run complex
   logic — **auto-shown once** (dismissal in `localStorage`), reopenable from a **"?"** in the canvas
   header.

5. **Description stays as the canvas's `instructions`.** Because the pairing is 1:1, the existing
   `canvases.instructions` ("purpose") already serves as the session's description; no new column. (A
   future move to `sessions.description` is a clean follow-up if desired.)

## Data model changes (`canvases`)

```python
styling  Mapped[dict]        = mapped_column(JSON, default=dict, nullable=False)  # per node/edge-type rules
banner   Mapped[str | None]  = mapped_column(Text)                                # base64 PNG, null until captured
```
- One additive Alembic revision (`024`), both defaulted/nullable — no backfill.
- `banner` excluded from `CanvasSummary`; `styling` included.

## API changes

- `POST` / `PATCH .../canvases` accept `styling` and `banner`; `CanvasDetail` returns `banner`,
  `CanvasSummary` returns `styling` + `has_banner`. No new endpoints.

## Studio changes

1. **Rail** — drop `canvasesItem` + the `"canvases"` native section; Explorer rail = Sessions + Model.
   `ExplorerPage` leftContent no longer branches to `CanvasesPanel`.
2. **`SessionTutorialModal`** — auto-once + "?" in `CanvasTabsBar`.
3. **Styling controls** in the canvas toolbar → `PATCH styling`; renderer applies `canvas.styling`.
4. **Banner capture** — `useCanvasBanner()` reaches the renderer (`renderer.extract`), downscales,
   PATCHes `banner` on save.

## Delivery — vertical slices

- **S1** — backend: `canvases.styling` + `banner` columns + migration + schema/service.
- **S2** — studio: single Sessions sidebar (drop Canvases panel/rail) + `SessionTutorialModal`.
- **S3** — banner capture. **S4** — styling controls + renderer application.

## Out of scope / non-goals

- Board / many-sessions container (reverted — Session is 1:1 with Canvas).
- Moving `instructions` → `sessions.description` (Decision 5 — follow-up).
- Reusable/graph-level style templates; server-side banner rendering; object-store images.
