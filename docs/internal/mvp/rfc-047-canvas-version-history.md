# RFC-047 — Canvas version history + live banner refresh

- **Status:** Proposed
- **Scope:** MVP (Explorer)
- **Supersedes / extends:** RFC-043 (canvases), RFC-045 (banner + styling), RFC-046 (operation log)

## Problem

Two gaps in the Explorer canvas, both about *seeing the canvas' state over time*:

1. **The banner is stale.** The sessions-list preview (RFC-045) is a downscaled PNG
   captured client-side from the PixiJS renderer. It is only refreshed on **blur** — tab
   switch, tab close, or back-to-list (`persistActiveCanvas({ withBanner: true })`). The
   frequent change-driven autosave writes `snapshot` + `positions` but deliberately skips
   the banner to stay cheap (`withBanner: false`). So a canvas a user is actively building
   shows an out-of-date (or missing) preview until they navigate away.

2. **There is no history.** The `canvases` row holds a single *current* state; every save
   overwrites the last (RFC-043). Once a query is re-run, a node expanded, or a layout
   changed, the previous state is gone. There is no way to look at what the canvas held a
   few turns ago, and no way to go back to it.

The user asked to (a) refresh the banner whenever the canvas is saved to the backend, and
(b) keep **state versions** they can "go back in time" to.

## Goal

- Keep the sessions-list banner **current** — refreshed on a short interval while a canvas
  is open, not only on blur.
- Record a **version** of the canvas at each meaningful turn, each carrying its own banner
  thumbnail, so the history is *visual* — the user sees past states and can restore one.

Decisions taken (product):

- **Cadence — per session turn.** A version is captured on each canvas-mutating turn: an
  NL/QL query (composer), a node **expand** (RFC-035), or a **load-to-canvas** (RFC-033) —
  the same set of turns RFC-046 logs. Not on every keystroke, not on a raw timer.
- **Retention — keep the newest N per canvas** (`INVANA_CANVAS_HISTORY_LIMIT`, default **30**;
  `0` = keep all). Older states are pruned on insert, bounding growth. (The original decision
  was keep-all; a bounded default was added so history can't grow without limit.)
- **Restore — open as a new canvas.** Going "back" **forks** the chosen version into a
  brand-new session + canvas; the current canvas is left untouched. No destructive rewind.

Non-goals: diffing/merging versions, naming/annotating versions, cross-canvas version
compare, server-side snapshot rendering, and pruning/quotas (deferred — revisit if storage
becomes a problem).

## Design

### Part A — Live banner refresh (Ask 1)

The banner is produced by `captureBanner()` (PixiJS `renderer.extract.base64` → downscale to
~600px). It is genuinely expensive, which is why the 800ms change-driven autosave skips it.
Rather than capture on every change, capture on a **throttled interval**:

- Add a **10s periodic autosave** in `ExplorerPage`: while a canvas is active and non-empty,
  a timer fires `persistActiveCanvas({ withBanner: true })` at most once per 10s. This is the
  literal "save every ~10s" behaviour, and it also catches **layout-only** changes (node
  drags) that the `canvasData`-keyed change effect misses.
- Keep the existing 800ms change-driven autosave (banner-less) for snapshot responsiveness.
- Throttle the banner so overlapping saves never double-capture: `persistActiveCanvas`
  tracks the last banner-capture time in a ref and skips a fresh capture if < 10s elapsed
  (blur/close still force one). Net cost: one extract+downscale per ≤10s per open canvas.

Result: the sessions-list preview reflects the canvas within ~10s of any change. No schema,
route, or model change — this is a studio-only tweak to the existing PATCH autosave.

### Part B — Version history (Ask 2)

#### Why client-driven

A version must carry the **rendered canvas state and a banner image** — both produced
client-side by the canvas engine; the engine (server) never sees them. So versions are
**created by the client**, at the same success hooks RFC-046 already uses to log turns
(composer send success, `useExpandNode` success, `recordLoad`), plus an explicit "Save current
state" click. The engine (server) stores and serves them. (Contrast RFC-046 expands, which the
engine logs atomically because it owns the *query text* — but not the render.)

The snapshot + image are the canvas engine's **own** serialisations (`@invana/canvas`
≥ 0.0.11): `canvas.exportState()` → a `CanvasStateSnapshot` (view + per-layer node/edge data
with positions + camera/styling), and `canvas.exportDataURL({ area, maxSize })` → a sized PNG
data URL. Restore hands the snapshot back to `canvas.importState()`. We no longer hand-roll a
PixiJS `extract` + offscreen downscale, nor a bespoke `{items}` snapshot shape.

#### Data model — `canvas_states`

New append-only table, one row per captured turn:

- `id` (PK, uuid), `canvas_id` (FK → `canvases`, CASCADE), `graph_id` (denormalized, mirrors
  `Canvas` — scopes the admin view / list without joining), `created_by_id` (FK → `users`,
  CASCADE; provenance).
- `message_id: str | None` (FK → `session_messages`, **SET NULL**) — the assistant turn that
  produced this state, for explainability (thread ↔ version). Provenance only, like
  `canvas.source_query`; a member viewing a shared canvas may not see the private thread.
- `kind: str` — `"query"` | `"expand"` | `"load"` (mirrors RFC-046 operations, plus `query`
  for composer turns) | `"manual"` (an explicit "Save current state" click).
- `label: str` — human summary for the timeline, composed client-side: e.g. `Ran query — 42
  nodes`, `Expanded "Acme Corp"`, `Loaded 8 nodes`.
- `snapshot_gz: bytes` — the `canvas.exportState()` envelope (view + layer data + positions),
  stored as **gzipped JSON** (see Storage); read through a `snapshot` property that decompresses
  transparently, so the API stays plain JSON. (No separate `positions` — it lives inside.)
- `source_query: str | None`, `styling: JSON`, `settings: JSON` — restore metadata (the base
  query, the RFC-045 per-type styling, and `{backend, magnet}`).
- `banner: str | None` — base64 PNG **thumbnail** (~288px, smaller than the 600px
  sessions-list banner — see Storage). What makes the timeline visual. Excluded from the list
  summary (heavy), like `Canvas.banner`.
- `node_count: int`, `edge_count: int` — for the summary/label without parsing the snapshot.
- `created_at`.

No `updated_at` (immutable), no `pinned`/`archived` (keep-all). Alembic revision **026**.
`CanvasStateView` added to `server/admin/views.py` under the Graphs section (banner
excluded from `fields` — heavy, not sensitive, but not worth rendering).

#### Storage

Keep-all × per-turn means these rows accumulate, so the two heavy fields are trimmed at the
source (cheapest wins, no new infra):

- **Thumbnail, not banner.** The state thumbnail is exported at ~288px (`STATE_THUMB_MAX_EDGE`)
  directly via `canvas.exportDataURL({ maxSize })`, several times lighter than the 600px
  sessions-list banner. The banner is the dominant cost and (being an already-compressed PNG in
  base64) resists DB compression, so shrinking its dimensions is the highest-value lever.
- **Gzipped snapshot.** The `exportState()` envelope is stored as gzipped JSON
  (`pack_json`/`unpack_json`) — it compresses ~5–10×, portably (helps SQLite dev + the at-rest
  bytes, not just Postgres TOAST).

A **retention cap** bounds total growth: each canvas keeps its newest
`INVANA_CANVAS_HISTORY_LIMIT` states (default 30), pruned on insert
(`CanvasStateStore.prune_for_canvas`) — the highest-leverage size control, independent of
per-row bytes.

**Object storage (MinIO) was considered and deferred.** The engine has no MinIO client yet
(it's future dataset/import-slice work); wiring it solely for states — with the two-system
consistency + orphan-cleanup cost hard deletes bring (CASCADE won't touch objects) — is
premature. When that shared client lands, the right shape is *metadata-in-Postgres,
blobs-in-MinIO* (offload `snapshot`/thumbnail objects, keep the queryable rows for
listing/scoping/cascade), with MinIO lifecycle rules doubling as retention.

#### API

Nested under the canvas, `require_graph_member` like the rest of `canvases/`:

- `POST   …/canvases/{id}/states` — create a version. Body: `{ kind, label, snapshot,
  source_query?, styling?, settings?, banner?, node_count, edge_count, message_id? }`
  (`snapshot` = the `exportState()` envelope). Returns `CanvasStateDetail`.
- `GET    …/canvases/{id}/states` — paginated **summary** list (newest first): `id, kind,
  label, node_count, edge_count, has_banner, message_id, created_at`. No snapshot/banner.
- `GET    …/canvases/{id}/states/{vid}` — **detail**: full snapshot + styling/settings + banner.

Restore has **no server endpoint** — it's client-driven (see Studio), because hydration runs
through the live canvas engine (`importState`), which only exists in the browser.

#### Studio

- After each canvas-mutating turn (and on "Save current state"), capture the version:
  `snapshot` from `canvas.exportState()`, `banner` from `canvas.exportDataURL({ maxSize: 288 })`,
  counts from the live store, plus `styling`/`settings`/`source_query`. POST it. Hooks already
  exist from RFC-046: composer send success, `useExpandNode` success, `recordLoad`. Best-effort
  — a failure never blocks the turn.
- **History UI:** a `History` button in the canvas header opens a **version timeline** panel
  (design-kit `Sheet`/`ScrollArea`) — newest-first rows, each a lazy-loaded banner thumbnail
  + `label` + relative time (absolute on hover), mirroring the sessions-list `SessionBanner`
  lazy pattern (`useCanvasStateBannerQuery`, cached by version id). Each row has **"Open as
  new canvas"** → restore (below). Optionally the thread's operation turns (RFC-046) link to
  their version via `message_id`.
- **Restore (client-driven fork):** `handleForkState` fetches the state, creates a fresh
  session + canvas, then hydrates the **live** canvas via `canvas.importState(snapshot)`
  (faithful — camera/styling/positions). It deliberately does *not* touch `seedData` (a
  competing `setData` would double-seed the WebGPU renderer — a known crash); the change
  autosave then persists the hydrated view onto the new canvas row in the standard `{items}`
  shape, so it reopens through the usual RFC-043 path (no format drift). The original canvas is
  untouched.
- **Manual save:** the panel header has a **"Save current state"** button that captures the
  live canvas immediately as a `manual` state (`captureCanvasState("manual", {immediate})`,
  toasted) — so a user can snapshot a good layout on demand, independent of the per-turn
  auto-captures.
- New `services/api/canvasStates.ts` + `hooks/queries/useCanvasStates.ts`
  (`useCanvasStatesQuery` / `useCanvasStateBannerQuery` / `useCreateCanvasStateMutation`). The
  stored entity is a **`CanvasState`** (table `canvas_states`); "version history" is the
  user-facing framing of that append-only log.

## Alternatives considered

- **Server-side, per-turn versions (no client render).** Rejected: the snapshot, positions,
  and banner are client-only; a server-captured version couldn't carry the thumbnail that
  makes "go back in time" visual, nor the exact painted layout.
- **In-place undoable restore** (snapshot current, then repaint the old version over the live
  canvas). Considered and **not chosen** — the user picked fork-to-new-canvas so the current
  work is never disturbed and both states remain side by side.
- **Prune to last N / time cap.** Not now — the user chose keep-all. The schema (append-only,
  `created_at`) makes adding a retention sweep later trivial if storage bites.
- **Capture the banner on every autosave (no throttle).** Rejected — `extract.base64` on
  every 800ms change janks the WebGPU renderer; the 10s throttle is the whole point of
  Part A.
- **Reuse `Canvas` rows for versions (a `parent_canvas_id` chain).** Heavier and conflates
  "a canvas you can open/edit" with "a frozen point in time"; a dedicated immutable table is
  simpler and keeps the canvases list clean.

## Rollout

Additive and backward-compatible. Part A is studio-only. Part B adds one new table, four new
routes, and a new studio panel — no changes to existing canvas/session rows or endpoints.
Existing canvases simply start accruing versions from their next turn. Migration 026 creates
the table with no backfill. Changeset required (user-facing).
