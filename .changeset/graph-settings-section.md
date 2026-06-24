---
"studio": minor
"invana": minor
---

Consolidate graph editing into a dedicated **Settings** panel and give **Archive** real behaviour.

**Settings panel.** The left-rail "Instructions" section is now **Settings** (gear icon) and owns every editable field on the graph — **name**, **description**, **instructions**, **objectives**, **success criteria** — shown **in edit mode by default** with a single **Save settings** button. The **Info** section is now a read-only overview only (header, connection status, resource stats, setup wizard); its editable details moved to Settings. The setup wizard's "Instructions" step opens the Settings panel.

**Archive.** Archiving is now a proper labelled button with a confirmation dialog that explains what happens. Archived graphs are **hidden from the graph list** — `GET /api/v1/graphs` excludes them by default and accepts `?include_archived=true` to include them. The graph list page gains an **Active / Archived** toggle (with counts) to switch between the two. Archiving never deletes or blocks anything: archived graphs stay reachable by link, remain queryable, and can be unarchived anytime.

**Toasts.** Fixed a bug where **no toast notifications rendered anywhere in Studio** — app code resolved `sonner@1.7.x` while the mounted `<Toaster>` (from `@invana/design-kit`) used `sonner@2.x`, so the two used separate stores. Studio is now aligned to `sonner@^2.0.7`. The graph `PATCH` endpoint also adopts the RFC-028 `{ message, data }` envelope, so the save / archive / unarchive success toast text now comes from the backend (consistent with the rest of the app) rather than a hardcoded client string.
