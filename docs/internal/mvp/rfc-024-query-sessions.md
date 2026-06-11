# RFC-024: Query Sessions — persisted conversation threads

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-11
**Related**:
- **RFC-008** (Graphs & Query API) — defines the `POST .../query` execution endpoint and
  `QueryRequest`/`QueryResponse`. This RFC **removes the standalone `/query` route**: its execution
  core is extracted into a reusable service and the only HTTP entry point becomes the sessions message
  endpoint (see Decision 2). `QueryResponse` survives as the result DTO embedded in message responses.
- **RFC-011** (Studio Explorer) — the Explorer page now renders a Sessions UI (`SessionsPanel`,
  `SessionComposer`, `useSessions`) that holds threads in **frontend-only in-memory state**. This RFC
  gives that UI a backend to persist against.
- **RFC-017** (Graph as primary container) — sessions are graph-scoped; `graph_id` FK + cascade
  follow the same shape as other graph-scoped entities.
- **RFC-018** (Domain audit events) — adds `session.*` actions and a `session` target kind.
- **RFC-023** (binary membership) — access is "member of the graph or not"; sessions inherit that
  gate via `require_graph_member`.
- **MVP** — sessions persistence is **not currently in `mvp.md`**. Adopting this RFC requires adding a
  scope line first (see *Scope & MVP impact*).

---

## Problem / intent

The Explorer's "Sessions" panel (shipped as a frontend-only redesign of the old Query Console) presents
each ask/answer against a graph as a threaded conversation. Today a **session is purely browser state**:
`useSessions` keeps `Session[]` in React `useState`. Consequences:

- Sessions vanish on reload, navigation away, or a second tab — there is no history that survives.
- Nothing is written to the database, so **the admin panel cannot show sessions** (there is no
  `sessions` table to register a `ModelView` for). This is the concrete gap that prompted this RFC.
- There is no server-side record tying a query execution to the conversation that produced it — the
  `query.execute` audit event records the query but not the session.

The query execution path itself (`POST .../query`) already works and is stateless. What's missing is a
**persistence layer for the conversation** that wraps those executions: a `Session` with ordered
`SessionMessage` rows, graph-scoped and owned by the user who started it.

**Intent:** introduce a `sessions` + `session_messages` entity (model → store → services → routes),
register it in the admin, and repoint `useSessions` at the API so threads persist end-to-end — while
keeping `POST .../query` as the reusable low-level execution primitive.

---

## Decisions

1. **New graph-scoped entity, mirroring `instructions/` and `events/`.** A new `invana.sessions` module
   with `models.py` / `store.py` / `services.py` / `schemas.py` / `routes.py`. `Session` and
   `SessionMessage` import `Base` from `invana.modeller.models` like every other table. Sessions are
   **private to their creator** within a graph (Decision 6).

2. **Replace `POST .../query` with the sessions message endpoint.** *(Decided — the more invasive of
   the two options.)* The standalone `/query` route is removed; **every query execution flows through a
   session**, so every run is recorded in a thread. To keep the route layer thin, the
   connector-resolution / read-only-guard / capability / event-emit body is extracted from
   `server/routes/query.py` into a reusable `graphs`-level service `execute_query(session, graph,
   *, query, parameters) -> QueryResponse`; the session routes are its only callers. **Migration cost
   is low:** the engine has exactly one `/query` route (no CLI command, no other internal caller), and
   Studio already funnels execution through `useSessions`. *The rejected "keep `/query` as a primitive"
   option is in [Alternatives](#alternatives-considered).*

3. **Persist message metadata, not full result payloads.** A `SessionMessage` stores the summary a
   thread needs to render (role, content, status, `via`, `query_language`, `source_query`, `row_count`,
   `execution_time_ms`, `node_count`, `edge_count`) — **not** the nodes/edges/rows of the result. Graph
   results can be large and go stale; the canvas is repainted from a live re-run via `source_query`.
   This keeps `session_messages` light and avoids snapshotting graph state into the app DB.

4. **Denormalize running totals onto `Session`.** `node_count` / `edge_count` / `message_count` are
   maintained on the `Session` row as messages are appended, so the list view renders its meta line
   (the blue/purple counts + relative time) without aggregating `session_messages` on every list call.

5. **Hard delete, downward cascade only.** Deleting a `Session` hard-deletes its `session_messages`
   (FK `ON DELETE CASCADE`). Deleting the parent **`Graph`** cascades its sessions. A session delete
   **never** touches the graph or any lookup row. (Follows the project's delete semantics.)

6. **Sessions are private to the creator.** `created_by_id` scopes visibility: list/get/delete are
   filtered to `created_by_id == current_user.id`. Membership (`require_graph_member`) still gates the
   route, but one member cannot read another's threads. Shared/team sessions are out of scope (open
   question for a future RFC).

7. **NL stays unwired.** A `mode: "nl"` message persists the user message and an assistant message with
   the "not wired to the engine yet" content and `status: "ok"` — **no execution**. Wiring NL → engine
   is a separate RFC; this one only persists what the UI already produces.

8. **Register in the admin.** `SessionView` and `SessionMessageView` are added to
   `server/admin/views.py` + `add_view(...)`, grouped under a "Sessions" `DropDown`. This is the
   directly-requested outcome: sessions become visible/inspectable from `/admin`.

9. **Synchronous execution.** *(Decided.)* `POST .../sessions/{id}/messages` runs the query and returns
   the user message, assistant reply, and result in **one response** — matching today's `/query`
   semantics. A long-running query holds the request open; an async/streamed model (over the existing
   `useEventStream` SSE channel) is deferred to a future RFC, likely alongside NL/agent runs that
   actually need streaming.

10. **Re-execution is a separate, non-appending action.** *(Resolves the tension between Decision 2 and
    metadata-only results.)* Because the only execution path appends messages, repainting the canvas for
    a past message must NOT create new rows. So re-running is its own endpoint —
    `POST .../sessions/{id}/messages/{messageId}/run` — which re-executes that assistant message's
    stored `source_query`, returns a fresh `QueryResponse` for the canvas, and updates that message's
    metadata (`status` / `row_count` / `execution_time_ms` / `node_count` / `edge_count`) **in place**.
    Opening a session calls this on its latest `source_query`-bearing message to restore the canvas;
    the per-message "re-run" button hits the same endpoint. No thread pollution.

11. **`created_by_id` CASCADEs on user deletion.** *(Decided — reverses the draft's `SET NULL`.)*
    Sessions are private user workspace, not an audit trail — the `events` table is the durable record
    (append-only, `SET NULL` actor) and independently retains every `query.execute`. So a deleted
    user's private sessions are removed with them: honors erasure (GDPR Art. 17 / offboarding), avoids
    orphaned PII-bearing rows visible to no app user, and keeps compliance attribution in `events`.
    This is a **fixed, DB-level `ON DELETE CASCADE`** — purge-only, with no configurability hook.
    Conversation-content retention / legal hold is an explicit **non-goal** (see Out of scope); should an
    enterprise need ever land, it is a deliberate future effort that migrates this constraint, not
    something this schema leaves a seam for.

12. **Titles: truncated first prompt, user-editable.** Auto-title from the truncated first prompt
    (matches the UI, deterministic, works for QL and NL). A `PATCH /sessions/{id}` lets the user rename.
    LLM-generated titles are deferred to NL/LLM wiring (for raw Cypher a "summary" just restates the
    query).

13. **Retention: indefinite until deleted.** Sessions persist until the user deletes them (the row is
    metadata-only and light). No TTL/cron in MVP; a future bulk "clear history" action can come later.

---

## Design

### Data Model

```python
# invana/sessions/models.py
class SessionMessageRole(enum.StrEnum):
    user = "user"
    assistant = "assistant"

class SessionMessageStatus(enum.StrEnum):
    running = "running"
    ok = "ok"
    error = "error"

class Session(Base):
    __tablename__ = "sessions"

    id            : str       # uuid, pk
    graph_id      : str       # FK graphs.id      ON DELETE CASCADE, indexed
    created_by_id : str       # FK users.id       ON DELETE CASCADE, indexed (Decision 11)
    title         : str       # 255; truncated first prompt, user-editable (Decision 12)

    # Denormalized running totals (Decision 4)
    message_count : int = 0
    node_count    : int = 0
    edge_count    : int = 0

    created_at    : datetime
    updated_at    : datetime  # onupdate -> bumped on each appended message

class SessionMessage(Base):
    __tablename__ = "session_messages"

    id              : str      # uuid, pk
    session_id      : str      # FK sessions.id   ON DELETE CASCADE, indexed
    seq             : int      # monotonic per-session ordering (1,2,3…)
    role            : SessionMessageRole
    content         : str      # Text

    # assistant-only metadata (null on user rows)
    status          : SessionMessageStatus | None
    via             : str | None       # "Cypher" | "Gremlin" | (future) model id
    query_language  : str | None
    source_query    : str | None       # the QL that produced this reply → re-run
    row_count       : int | None
    execution_time_ms: int | None
    node_count      : int | None
    edge_count      : int | None

    created_at      : datetime
```

`(session_id, seq)` is unique; `seq` gives stable ordering independent of `created_at` collisions.

### API Surface

All routes graph-scoped under `/api/v1/u/{username}/{graphSlug}`, gated by `require_graph_member`, and
filtered to the current user's own sessions.

```
GET    /sessions                      → list sessions (newest updated first, paginated)
       Response: { items: SessionSummary[], total, ... }

POST   /sessions                      → create a session, optionally send a first message
       Request:  { title?: string, message?: SendMessage }
       Response: SessionDetail         (includes messages + the run result, if message sent)

GET    /sessions/{id}                 → session + ordered messages
       Response: SessionDetail

PATCH  /sessions/{id}                 → rename (Decision 12)
       Request:  { title: string }
       Response: SessionSummary

DELETE /sessions/{id}                 → hard delete (cascades messages); 204

POST   /sessions/{id}/messages        → append a user message, run it, append the assistant reply
       Request:  SendMessage = { content, mode: "ql"|"nl",
                                  language?: QueryLanguage, parameters?: object }
       Response: { user_message: Message, assistant_message: Message,
                   result: QueryResponse | null }   # result null for nl / on error

POST   /sessions/{id}/messages/{messageId}/run   → re-execute an existing assistant message's
       source_query WITHOUT appending; repaints the canvas + updates that message's metadata in place
       Response: { message: Message, result: QueryResponse }   # 409 if message has no source_query
```

- `SessionSummary` = session row fields (id, title, counts, updated_at) — drives the list.
- `SessionDetail` = summary + `messages: Message[]`.
- `result` carries the existing `QueryResponse` (graph/tabular payload) so Studio paints the canvas;
  it is **not** persisted (Decision 3).
- **The standalone `POST .../query` route is removed** (Decision 2); `require_graph_setup_complete` and
  `require_graph_member` now gate the message + run endpoints instead.

The one-call "ask from the list" UX (no active session) maps to `POST /sessions` with a `message`;
asking inside an open session maps to `POST /sessions/{id}/messages`.

### Studio integration

`useSessions` stops owning `Session[]` in `useState` and becomes a thin TanStack Query layer:

- `useSessionsQuery(username, graphSlug)` — list (the panel's list view).
- `useSessionQuery(id)` — detail (the thread view), enabled when a session is active.
- `useSendMessage()` — mutation hitting `POST /sessions[/{id}]/messages`, with **optimistic** append of
  the user message + a `running` assistant placeholder, reconciled from the response; invalidates the
  list + detail queries on settle. `ExplorerPage.handleRun` still reads `result` to paint the canvas.
- `useRerunMessage()` — mutation hitting `POST /sessions/{id}/messages/{messageId}/run`; called on
  session open (latest `source_query` message) to restore the canvas, and by the per-message re-run
  button. Does not append; reconciles the one message's metadata.
- `graphsApi` gains a `sessions.*` group (list/get/create/delete/sendMessage/rerunMessage); the existing
  `graphsApi.query()` and the `/query` request path are **removed** (Decision 2). `QueryResponse` stays
  as the result DTO; `QueryRequest` is retired at the route layer.
- `types/session.ts` aligns with the API DTOs (snake_case mapped at the api layer). The composer's
  `send` and the thread's re-run (`source_query`) flow through the mutation unchanged in spirit.

The UI built in the prior redesign (panel/list/thread/composer) does not change shape — only its data
source moves from memory to the server.

### Storage / migrations

One Alembic revision (under `invana/modeller/migrations`, the shared metadata home) creating `sessions`
and `session_messages` with the FKs/indexes/cascades above. No backfill — there is no prior persisted
session data (it was all in-memory).

### Admin

`server/admin/views.py`: add `SessionView` (fields: id, graph_id, created_by_id, title, message_count,
node_count, edge_count, created_at, updated_at; `search_fields=["title"]`) and `SessionMessageView`
(id, session_id, seq, role, status, via, query_language, row_count, execution_time_ms, created_at),
registered via `add_view(...)` under a "Sessions" `DropDown`.

### Events

`events/actions.py`: add `SESSION_CREATE`, `SESSION_DELETE`, and `TARGET_SESSION`. The existing
`QUERY_EXECUTE` event continues to fire from the shared execution service; its `details` gain a
`session_id` so a query execution can be traced to its thread.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| **Keep `/query` as a standalone primitive; sessions wrap it** | A stateless way to run a query for admin/CLI/tools without opening a session; smaller change to RFC-008 | Two execution entry points to keep in sync; some runs escape the session record | **Rejected** (Decision 2) — there are no non-session callers today (no CLI query command, single internal route), so a primitive earns nothing now; one execution path keeps every run recorded in a thread. |
| **Persist full result payloads on each message** | Threads re-render without re-querying; offline view of past results | `session_messages` bloats with graph snapshots; results go stale vs the live DB; snapshotting graph state into the app DB is a data-governance smell | Rejected — store metadata, re-run via `source_query` (Decision 3). |
| **Keep sessions client-only (status quo)** | Zero backend work | No persistence, no admin visibility, no cross-device history — the exact gaps motivating this RFC | Rejected — defeats the purpose. |
| **Sessions shared across all graph members** | Team-visible history | Needs a sharing/visibility model + redaction story; premature under binary membership (RFC-023) | Deferred — private-to-creator now (Decision 6); revisit in a future RFC. |

---

## Security Considerations

- **Authorization**: every route requires `require_graph_member` (RFC-023) **and** filters to
  `created_by_id == current_user.id` — a member cannot read or delete another member's sessions.
- **Setup gate**: `POST /messages` reuses `require_graph_setup_complete`, matching `/query`.
- **Read-only graphs**: the shared execution service keeps the existing write-rejection guard, so a
  message cannot smuggle a write past a read-only connection.
- **Injection / size**: `content` and `source_query` are stored verbatim as parameters (never
  interpolated); enforce a max length on `content` to bound row size.
- **Cross-graph leakage**: `session_id` lookups are always re-scoped to the resolved `graph_id` so an
  id from another graph cannot be addressed.

## Performance Considerations

- List view reads denormalized counts off `Session` (Decision 4) — no `session_messages` aggregation
  per list call. Index on `(graph_id, created_by_id)` + order by `updated_at`.
- Messages read by `session_id` (indexed) ordered by `seq`.
- No full result payloads stored → `session_messages` stays small; re-run cost is one live query, same
  as today.

### Decided (2026-06-11)

- **Visibility** → private to the creator (Decision 6).
- **Execution** → synchronous request/response (Decision 9).
- **Past results / canvas** → metadata-only; reopening re-runs `source_query` via the non-appending
  run endpoint (Decisions 3 + 10).
- **`/query` fate** → removed; sessions are the only execution entry point (Decision 2).
- **User deletion** → `created_by_id` CASCADEs; `events` is the audit record (Decision 11).
- **Titles** → truncated first prompt, user-editable via `PATCH` (Decision 12).
- **Retention** → indefinite until deleted (Decision 13).
- **Pagination** → `/sessions` newest-`updated_at` first, offset/limit, default page 30; session
  messages loaded in full on open (threads are realistically small; the re-run-on-open needs the
  latest message anyway). Windowing added only if a thread becomes pathological.
- **No ephemeral/scratch execution** (accepted) → every run creates or appends to a session; a one-off
  "just run this" leaves a deletable thread. Revisit only if scratch execution becomes a real need
  (a future ephemeral/auto-pruned session, or reinstating a primitive).

All design questions are resolved; nothing is left open.

### Out of scope (non-goals)

- **Configurable erasure / data-retention policy** — no `ERASURE_MODE` deployment setting, no
  anonymize path. User deletion purges sessions via hard CASCADE (Decision 11), full stop.
- **Deactivate-vs-delete user lifecycle, legal hold, conversation export** — not addressed here. The
  `events` audit trail independently retains each `query.execute` record, but **conversation content is
  not retained** past user deletion. If an enterprise retention requirement ever arises, it is a
  separate platform governance effort (which would migrate the CASCADE constraint) — explicitly *not*
  pre-built or seamed for by this RFC.

## Implementation Plan

1. [ ] Extract the execution core from `server/routes/query.py` into a shared `graphs` service
       (`execute_query`) — connector resolution, read-only guard, capability resolution, event emit.
2. [ ] Add `invana/sessions/models.py` (`Session`, `SessionMessage`) + Alembic migration.
3. [ ] Add `sessions/store.py` + `sessions/services.py` (create, list-for-user, get, rename, delete,
       append-message-and-run, **re-execute-in-place** — all via the shared `execute_query`).
4. [ ] Add `sessions/schemas.py` + `sessions/routes.py` (incl. `PATCH /{id}` rename + `/messages/{id}/run`); register
       `sessions_router` in `server/app.py`. **Remove** `query_router`, its `include_router`, and
       `server/routes/query.py`.
5. [ ] Add `SESSION_CREATE` / `SESSION_DELETE` + `TARGET_SESSION` to `events/actions.py`; thread
       `session_id` into the `query.execute` event details (now emitted from `execute_query`).
6. [ ] Register `SessionView` / `SessionMessageView` in `server/admin/views.py`.
7. [ ] Tests: a few positive + negative (create+send runs a real query against a graph DB and persists
       both messages; re-run updates metadata in place and adds **no** new message; nl persists the
       unwired reply with no execution; cross-user get is 404; graph delete cascades sessions). Rewrite
       the existing `/query` test onto the sessions endpoint. Per repo rules: few, real graph DBs, no mocks.
8. [ ] Studio: add `graphsApi.sessions.*` and **remove** `graphsApi.query()`; add
       `useSessionsQuery`/`useSessionQuery`/`useSendMessage`/`useRerunMessage`; repoint `useSessions`
       off `useState`; re-run the latest message on session open to restore the canvas; keep the
       existing panel/composer UI.
9. [ ] Changeset (user-facing) + update `mvp.md` scope line (see below).

## Scope & MVP impact

Per `CLAUDE.md`, `mvp.md` is the authoritative work list and new work must not be silently re-scoped.
The scope line is now in place — **`mvp.md` § 5.6 Query Sessions (persistence)** carries the
Backend / Frontend / Integrations triplet, with §§ 5.1 / 5.5 cross-noted (the standalone `/query` route
is superseded; the Explorer console is redesigned into the Sessions panel). This RFC is now `Accepted`
and implementation tracks against § 5.6.

## References

- `docs/rfcs/008-graphs-query-api.md` — the execution endpoint this RFC wraps.
- `docs/rfcs/011-studio-explorer.md` — the Explorer surface hosting the Sessions panel.
- `engine/src/invana/instructions/` — the model→store→services→routes pattern this module mirrors.
- `engine/src/invana/events/models.py` — append-log shape referenced for `session_messages`.
- `engine/src/invana/server/admin/views.py` — where `SessionView` registers.
