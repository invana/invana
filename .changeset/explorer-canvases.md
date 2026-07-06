---
"invana": minor
"studio": minor
---

Add saved Explorer canvases (RFC-043).

A **canvas** persists a painted view of the graph — the snapshot (nodes/edges), node positions, viewport, filters and settings — plus a title and a written **purpose**. Canvases are **shared across every graph member** and each is backed **1:1 by a session** (`canvas.session_id` unique + `ON DELETE CASCADE`); the canvas is self-contained (its own snapshot + copied `source_query`) so a member renders it without reading the private backing thread.

**Engine:** new `invana.canvases` module (model / store / services / schemas / routes) with graph-scoped CRUD under `/api/v1/u/{username}/{graphSlug}/canvases` (shared — gated on `require_graph_member`, not creator-filtered; `?include_archived`), an Alembic revision for the `canvases` table, a `CanvasView` admin, and `canvas.create` / `canvas.update` / `canvas.delete` audit events.

**Studio:** a new **Canvases** left-rail panel in the Explorer (beside Sessions and Model) — a paginated list of the graph's canvases with per-row edit (title + purpose dialog), pin, archive and delete, plus click-to-open. Canvases open as **tabs in the main-section header** (the canvas toolbar sits in the app header above); the **"+"** starts a blank canvas (a fresh session + canvas), and switching tabs switches the active query session so new queries belong to that canvas. Opening a canvas hydrates it from its saved snapshot + node positions; switching or closing a tab autosaves the view.
