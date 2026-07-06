# RFC-046 — Session operation log: expand + load-to-canvas turns

- **Status:** Accepted
- **Scope:** MVP (Explorer)
- **Supersedes / extends:** RFC-024 (sessions), RFC-033 (inline results), RFC-035 (node expand), RFC-043/045 (canvases)

## Problem

A session thread today records only the queries a user runs through the composer —
natural-language (NL) asks translated server-side (RFC-030) and hand-typed query-language
(QL) asks. Both flow through `send_message` and land as a user/assistant message pair.

But a session's canvas is also mutated by operations that never touch the composer:

- **Node expand / traversal** (RFC-035) — right-click a node → "expand", or the Fine-tune
  panel. These POST to `/explorer/expand/*`, append neighbours to the canvas, and emit only
  a `graph.expand` audit event. They are **invisible in the thread**.
- **Load to canvas** (RFC-033) — projecting a past result onto the canvas.

So the thread is not a faithful log of "what happened on this session". The user asked to
"see all the query operations done on the session with NL, QL, or expand queries (QL)".

## Goal

Record canvas-mutating operations as first-class turns in the session thread, alongside NL
and QL queries, so the thread is a complete, explainable log. Expand turns carry the real
generated query (Cypher/Gremlin) so they're traceable (explainability is a core product
value: LLM → query → record).

Two operation kinds in this RFC:

1. `expand` — a node-expand / traversal. Recorded **server-side**, atomically with the
   expand, because the engine owns the generated query text.
2. `load` — an explicit "Load to canvas" click. Recorded via a small **client-driven**
   endpoint, because no query executes (an existing result is re-projected); the client
   supplies the referenced query + counts.

Non-goals: styling/layout changes, automatic (non-click) canvas paints, and re-running an
expand as an accumulating traversal. Those are out of scope.

## Design

### Message model

`SessionMessage` gets one nullable column:

- `operation: str | None` — `"expand"` | `"load"`, or `null` for a normal composer turn.

Set on **both** rows of the pair so the UI can style the user row as a left-aligned
operation header (not a right-aligned chat bubble) and can exclude operation turns from
places that must only see composer queries (see below). A migration adds the column
(nullable, no backfill — existing rows are composer turns).

An `expand` assistant message reuses the existing fields: `source_query` (the generated
query), `query_language`, `via` (`Cypher`/`Gremlin`), `row_count`, `execution_time_ms`,
`node_count`, `edge_count`, `status="ok"`, `mode="ql"` (it *is* a QL operation). A `load`
turn is the same but references the loaded query (no fresh execution timing beyond what the
client passes).

### Capturing the generated expand query

The expand `data_reader` methods build `(query, params)` then discard the query. Add
`query: str | None = None` to `ResultMetadata` and have the three neighbour-read methods
(`read_neighbors`, `read_neighbors_by_edge_type`, `read_neighbors_by_node_type`) in both the
Cypher and Gremlin readers set `response.metadata.query` before returning. This is generic,
non-breaking (defaults to `None`), and gives honest QL for the thread.

### Shared recording helper

`sessions.services.record_operation(session, *, sess, kind, user_content, summary,
source_query, query_language, row_count, execution_time_ms, node_count, edge_count,
add_to_totals)` appends a user + assistant message pair (`operation=kind`, assistant
`status="ok"`), bumps `message_count += 2` and `last_status`, and — when `add_to_totals` —
adds the node/edge counts to the session's running totals. Both entry points below call it.

### Expand (server-side)

- The three expand request schemas get optional `session_id: str | None`.
- After `_finalize`, if `session_id` resolves to a session owned by the caller in this graph
  (looked up leniently — an unknown id is **skipped, not fatal**, so a bad id never breaks
  the expand), the explorer service calls `record_operation` with `kind="expand"`,
  `add_to_totals=True`, `source_query=data.metadata.query`,
  `execution_time_ms=data.metadata.duration_ms`, and counts from the returned slice.
- The route already owns the transaction, so recording commits atomically with the expand.

`user_content` is engine-composed from what it knows: e.g. `Expand neighbours of <id>`,
`Expand <edge_label> neighbours of <id>`, `Expand <neighbor_label> neighbours of <id>`.
(Richer display labels from the client are a future enhancement.)

### Load to canvas (client-driven)

`POST /sessions/{id}/operations` with `{ kind: "load", source_query, query_language?,
row_count?, node_count?, edge_count?, execution_time_ms? }` records a `load` pair via
`record_operation` with `add_to_totals=False` (the query's rows were already counted when it
ran — re-projecting must not double-count). Only explicit "Load to canvas" **clicks** are
logged; automatic paints (session-create, restore) are not.

### Studio

- `operation` flows through the message DTO/mapper and `SessionMessage` type.
- Expand: `useExpandNode` includes the active `session_id`; on success the active session
  detail is refetched so the new turn appears. The Fine-tune panel's paginated "Load next"
  is a single expand op per page (each is a real query), consistent with the thread.
- Load: the "Load to canvas" button reports the operation (its message's `sourceQuery` +
  the result's language/counts) after painting; the automatic paint path does not.
- Thread rendering: operation turns render the user row as a left-aligned header with an
  icon; the assistant row reuses the existing result meta + "View query" disclosure.
- Operation turns are **excluded** from: the NL context replay (`_context_turns` — so an
  expand's neighbour query never pollutes translation), the canvas-restore pick and the
  canvas `source_query` autosave (restore the base query, not an expand), the composer
  mode/model restore, and the composer ↑/↓ prompt history.

## Alternatives considered

- **One generic client endpoint for both kinds.** Rejected for expand: the engine generates
  the query, and a client-supplied query would be unverifiable/spoofable and a second round
  trip. Expand records where the query is born.
- **A distinct `role` / separate table for operations.** Heavier; the existing message pair
  + one `operation` discriminator reuses all rendering, context, and totals machinery.
- **Reconstruct a descriptive pseudo-query for expand.** Rejected — showing the real
  generated query is the honest, explainable thing and it already exists internally.

## Rollout

Additive and backward-compatible: the new column is nullable, the expand `session_id` is
optional, and the operations endpoint is new. Existing sessions and clients are unaffected.
