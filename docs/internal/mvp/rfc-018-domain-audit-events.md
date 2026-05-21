# RFC-018: Domain audit events

**Status**: Draft
**Author**: Invana Team
**Date**: 2026-05-22
**Related**: RFC-007 (Telemetry — complementary signal, not redundant); RFC-017 (Graph as the primary container — events are graph-scoped where applicable).

---

## Problem

Today the engine has trace-level observability (RFC-007: OpenTelemetry spans for every HTTP request) but no **domain-level** observability. There is no way to answer:

- "Who changed the Anthropic API key on this Graph yesterday?"
- "When was this Skill last edited, and what was the previous body?"
- "Which members have been invited to this Graph, and which still haven't accepted?"
- "Show me everything that's happened on this Graph in the last 24 hours."
- "What writes did this user perform across all Graphs?" (superuser audit)

Traces answer "what happened to this request"; they don't answer "what happened to this *entity*". For a multi-tenant platform where users collaborate on the same Graph, the per-entity history is what makes the system **legible** to its operators — both end users (graph members) and platform admins (superusers).

There's also no UI surface for this today. The Studio shows current state only.

---

## Goals

1. Every domain-level write produces a structured audit-event row alongside the state change.
2. Events are queryable by `(graph_id, time range)` and by `(actor_id, time range)` for both global and per-graph views.
3. Per-graph Events surface in the Studio (new rail icon on graph-scoped pages); global Events surface for superusers only.
4. Auth / identity events (register / login / password change / etc.) are captured even though they have no `graph_id`.
5. Background / system actions (auto-reconnect, schema introspection completion, future agent runs) are captured with `actor_type=system`.
6. Query executions are captured but with a separate retention policy (high volume, low individual value).
7. State remains the source of truth — this is an **audit log**, not event sourcing. The events table is append-only and read-only via API.
8. Each event carries the OTel `trace_id` of the originating request, so events and traces correlate cleanly.

## Non-goals

- **Not** event sourcing. State stays in its existing tables; events are derived. Adopting full CQRS / projections is a separate (much larger) RFC.
- Not a replacement for OTel traces / metrics / logs. Different signal, different consumer.
- Not webhooks / external delivery (deferred — see § Open questions).
- Not retro-fitting events for past writes that pre-dated this RFC (starts from migration date forward).

---

## Decision summary

- **Audit-log pattern.** One `events` table; one row per domain write.
- **Manual emission via `emit_event(...)` helper** called from service-layer functions (not auto-magic SQLAlchemy hooks). Explicit, grep-able, lets us capture context (actor, request-time changed-keys diff) without per-table boilerplate.
- **Schema** carries `(graph_id?, actor_id?, actor_type, action, target_kind, target_id?, details JSONB, trace_id?, created_at)`. `graph_id` and `actor_id` are nullable so auth and system events fit the same row shape.
- **Details payload** = **changed-keys diff only** for updates: `{changed: {field: {before, after}}}`, skipping unchanged keys. Create / delete events store a `{name: ...}` snapshot for human-readable context after the entity is gone. Sensitive fields (`api_key`, `password`, `*_hash`, `*_encrypted`) are *always* omitted regardless.
- **Read API:** `GET /api/v1/events` (superuser only, all events, paginated) and `GET /api/v1/u/{username}/{graphSlug}/events` (any graph member, scoped to that graph). Plus SSE companions for live tail (see § Live tail).
- **Write API:** none. Events are emitted only by the engine itself.
- **Studio:** new rail icon (Events) on every graph-scoped page; new full-page `/platform/events` (superuser only) reachable from `UserMenu`.
- **Retention:** **forever — audit logs are immutable.** No pruning, no TTL. Long-term storage planning (partitioning) is a separate ops concern, not in this RFC.
- **Live tail:** SSE in v1. Server uses Postgres `LISTEN/NOTIFY` so multi-worker deployments fan out correctly without an external pub/sub.
- **No new external dependencies.** Uses existing Postgres + SQLAlchemy + FastAPI; integrates with existing OTel via `trace_id` correlation.

---

## Schema

New table `events`:

```
events
─────────────────────────────────────────────────────────────────────────
id              UUID         PK
graph_id        FK graphs.id ON DELETE SET NULL    nullable
                — when set, event participates in the graph-scoped view.
                — auth / global events have graph_id = NULL.
                — SET NULL (not CASCADE) so the audit trail outlives the
                  graph it described; a graph delete is itself an event.
actor_id        FK users.id  ON DELETE SET NULL    nullable
                — null when actor_type=system.
actor_type      Enum         user | system | anonymous
                — anonymous covers pre-auth events (e.g. failed login).
action          String(64)   NOT NULL
                — verb keyed string: "graph.create", "skill.update",
                  "connection.test", "query.execute", "auth.login", ...
                  Hierarchical so prefix filters work (action LIKE 'graph.%').
target_kind     String(32)   nullable
                — "graph" | "skill" | "instruction" | "llm_provider" |
                  "connection" | "member" | "invitation" | "user" |
                  "query" | "session"
target_id       String(36)   nullable
                — UUID of the target entity. Null for non-entity actions
                  (auth.login, query.execute).
details         JSONB        NOT NULL DEFAULT '{}'::jsonb
                — free-form payload. Conventions:
                  - "before" / "after" diffs for updates
                  - "name" / "summary" snapshots for create/delete (since
                    target_id won't resolve after a delete)
                  - "duration_ms", "row_count" for query.execute
                  - "ip", "user_agent" for auth events
                  - "error" for failures we choose to log
                  - api_key_encrypted / password_hash etc. NEVER stored
trace_id        String(32)   nullable
                — hex OTel trace id from the originating request. Lets
                  the events view link out to the trace in Jaeger/SigNoz.
created_at      Timestamptz  NOT NULL DEFAULT now()
```

**Indexes:**
- `(graph_id, created_at DESC)` — drives the per-graph view.
- `(created_at DESC)` — drives the global view.
- `(actor_id, created_at DESC)` — drives "all actions by this user" (admin audit).
- `(action, created_at DESC)` partial on retention buckets — drives the retention prune cron.

**Why `ON DELETE SET NULL` on both FKs:** the audit trail must survive deletion of the entities it describes. If you delete a Graph, the "graph.delete" event is itself an event we want to keep — the FK going null is acceptable; the event's `details` carries a snapshot of the deleted graph's name + slug for human readability.

---

## Action vocabulary (initial)

Hierarchical dotted-path strings, keyed by feature area:

| Prefix | Examples |
| ------ | -------- |
| `graph.*` | `graph.create`, `graph.update`, `graph.delete`, `graph.archive`, `graph.unarchive` |
| `connection.*` | `connection.attach`, `connection.update`, `connection.delete`, `connection.test`, `connection.ping`, `connection.introspect` |
| `member.*` | `member.add`, `member.role_change`, `member.remove` |
| `invitation.*` | `invitation.create`, `invitation.delete`, `invitation.accept` |
| `llm.*` | `llm.create`, `llm.update`, `llm.delete`, `llm.ping`, `llm.set_default` |
| `skill.*` | `skill.create`, `skill.update`, `skill.delete` |
| `instruction.*` | `instruction.create`, `instruction.update`, `instruction.delete` |
| `setup.*` | `setup.complete`, `setup.skip`, `setup.reset` |
| `auth.*` | `auth.register`, `auth.login`, `auth.logout`, `auth.refresh`, `auth.password_change`, `auth.username_change`, `auth.login_failed` |
| `query.*` | `query.execute` (with language + duration + row_count in `details`) |
| `system.*` | `system.connection_health_check`, `system.connection_reconnect`, `system.introspect_complete` |
| `agent.*` (future) | `agent.run.start`, `agent.run.complete`, `agent.run.error` |

The vocabulary is open — new prefixes get added when new domains land. Lives in `invana.events.actions` as a module-level constants file so callers grep `EVENT_ACTIONS.SKILL_UPDATE` rather than passing strings.

---

## Emission

### Helper

New module `engine/src/invana/events/`:

- `models.py` — `Event` SQLAlchemy model.
- `schemas.py` — `EventRead` + list response Pydantic.
- `store.py` — DB access (insert + paginated read).
- `services.py` — `emit_event(...)` helper:
  ```python
  async def emit_event(
      session: AsyncSession,
      *,
      action: str,
      target_kind: str | None = None,
      target_id: str | None = None,
      graph_id: str | None = None,
      actor_id: str | None = None,
      actor_type: ActorType = ActorType.user,
      details: dict | None = None,
      trace_id: str | None = None,
  ) -> Event: ...
  ```
  Idempotent — multiple calls in the same transaction are fine. Inserts into the same session as the state change so they commit atomically (or roll back together).
- `routes.py` — `events_router` (global) + a per-graph sub-router (described below).
- `actions.py` — action-name constants.

### Call sites

Emission is **manual** at the service layer, not in routes (so background work emits too, and so we keep route handlers thin). One call per write, immediately after the state mutation, *before* `session.commit()`. Example for `services.create_skill`:

```python
skill = await SkillStore().add(session, skill)
await emit_event(
    session,
    action=ACTIONS.SKILL_CREATE,
    target_kind="skill",
    target_id=skill.id,
    graph_id=graph_id,
    actor_id=actor_id,
    details={"name": skill.name},
)
return skill
```

Helpers (`require_graph_admin`, `get_current_user`) already give us `actor_id`. For background work we pass `actor_type=ActorType.system, actor_id=None`.

For the `trace_id`: a small request-scoped dep `current_trace_id` reads it off the active OTel span and threads it through. Optional — events still write if telemetry is disabled.

### What is NOT emitted

- Pure reads (`GET /...`). Too noisy; covered by OTel traces.
- Failed validations (422) — covered by OTel + structured logs.
- Failed auth attempts beyond `auth.login_failed` (already covered).

---

## Read API

### Global — `GET /api/v1/events`

- **Auth:** superuser only (`is_superuser=True`).
- **Filters:** `?graph_id=` (optional), `?actor_id=`, `?action_prefix=` (e.g. `?action_prefix=skill.`), `?since=<iso8601>`, `?until=<iso8601>`.
- **Pagination:** keyset on `(created_at DESC, id DESC)` — `?cursor=<opaque>` returns the next page.
- **Response:** `{items: EventRead[], next_cursor: string | null}`.

### Per-graph — `GET /api/v1/u/{username}/{graphSlug}/events`

- **Auth:** any graph member (`require_graph_member`).
- **Server-side**: `WHERE graph_id = <resolved>`, otherwise same filter/cursor shape as the global endpoint.
- **Pagination:** same keyset.

### Event read shape (`EventRead`)

```
id              str
graph_id        str | null
actor           {id, username, display_name} | null    — denormalised at read time
actor_type      "user" | "system" | "anonymous"
action          str
target_kind     str | null
target_id       str | null
details         object
trace_id        str | null
created_at      datetime
```

The `actor` dict is denormalised from `users` so the UI doesn't need a second lookup per row. If the user is deleted (set-null FK), `actor` is `null` and `details.actor_username_snapshot` is the fallback display.

---

## Studio UI

### Per-graph: Events rail icon

- New `events` section in `useSettingsPanel`'s `SettingsSection` type.
- New rail icon (`Activity` from lucide) in `useGraphLeftNav` — visible to any member, between Instructions and Datasets, say.
- `EventsSection` component: virtualised list of events (newest first), each row showing action verb + target + actor + relative time. Click a row → expand to show `details` JSONB + trace link.
- Filter bar: action-prefix dropdown (`All` / `Graph` / `Connection` / `Skills` / ...), actor picker, time-range chips (`24h` / `7d` / `30d` / `All`).
- Full-page maximize target: `GraphEventsSettingsPage` at `/u/:username/:graphSlug/settings/events`.

### Global: Platform events page

- New top-level route **`/platform/events`** (new `/platform/*` namespace for superuser surfaces — avoids the collision with `/admin` which belongs to starlette-admin, and gives a clean prefix for future platform-admin tools).
- Reachable from `UserMenu` → "Platform events" (RoleGate gates the menu item to `superuser`).
- Same component shape as `EventsSection` plus a `graph` filter dropdown (all graphs the platform has, since superuser).

---

## Retention

**Events are forever.** This is an audit log; nothing in it is ever deleted. No TTL, no pruning cron, no per-category retention buckets, no admin settings to tune. The append-only invariant is the point — operators need to trust that a `member.role_change` from two years ago is still queryable.

Consequences:

- **`query.execute` is captured for every call.** Studio's Explorer + agent loops will be the dominant write source. Sized at MVP scale (low hundreds of concurrent graphs, 10s of queries/hour each), the table grows at a manageable rate; long-term partitioning is a future ops concern, not a v1 design decision.
- **No `DELETE` paths on `/events` routes.** Read-only API; emission is engine-internal.
- **Time-based partitioning (e.g. monthly `events_2026_05` children via `PARTITION BY RANGE (created_at)`) is the planned growth strategy** when the table crosses ~10M rows. Out of scope for v1 — but the schema deliberately uses `created_at DESC` indexes that survive partitioning unchanged.

---

## Live tail (SSE)

The Events views (per-graph + global) push new events to connected Studio sessions in real time via Server-Sent Events.

### Endpoints

- `GET /api/v1/u/{username}/{graphSlug}/events/stream` — emits new events for this graph as they're inserted. Auth: `require_graph_member`.
- `GET /api/v1/events/stream` — global SSE for superuser. Same shape, no graph filter.

Each event frame is the same `EventRead` JSON as the paginated read endpoint, one per `event:` line, terminated by a blank line.

### Server implementation: Postgres `LISTEN / NOTIFY`

- A trigger on `events INSERT` calls `pg_notify('events', row_to_json(NEW)::text)`. (Or — we issue `NOTIFY` from `emit_event` after the insert, before commit. Trigger is simpler + survives bypass; chose trigger.)
- The engine maintains one dedicated asyncpg connection per worker process, in `LISTEN events` mode. Incoming notifications are fanned out to all open SSE clients of that worker.
- Each SSE handler subscribes to an in-process channel filtered by `(graph_id == this graph)` (or unfiltered for the global stream). Filtering happens server-side after parsing the notification payload so we don't ship events the viewer isn't allowed to see.
- Heartbeat: `: keepalive\n\n` every 25s to keep proxies (nginx, ELB) from closing idle connections.
- Backpressure: per-client queue with a cap (e.g. 1k events); if a slow client overflows, the handler drops the oldest events and emits a `event: lost\n` sentinel so the client can request a refetch.

### Why LISTEN/NOTIFY (and not in-memory pub/sub)

- Works across uvicorn workers / Gunicorn processes without an external broker. In-memory pub/sub silently breaks under multi-process deployment (each worker has its own bus).
- Native Postgres feature, asyncpg supports it natively, zero new dependencies.
- Payload limit is 8 KiB per notification, which fits our row shape comfortably (no large JSONB diffs near this threshold; if they ever are, the trigger sends `{id}` only and the SSE handler re-fetches).

### Studio: `useEventStream`

- Hook around the native `EventSource` API; opens a connection scoped to the active section (`/u/.../events/stream` for the rail section; `/api/v1/events/stream` for the platform page).
- On each frame: prepend to the TanStack Query cache for the events list (`queryClient.setQueryData(...)`). Pagination state remains intact — only the "newest" head moves.
- Connection lifecycle: `EventSource` auto-reconnects on transient drops; we cap reconnect attempts and fall back to polling if the SSE endpoint 5xx's repeatedly.

---

## Trade-offs / alternatives considered

| Considered | Why rejected |
| ---------- | ------------ |
| **Full event sourcing (CQRS + projections)** | Bigger architectural commitment — requires rebuilding read models from event stream, snapshots, replay tooling. Most of the value (observability + history) is captured by the audit-log pattern with 1/10 the surface area. Keep CQRS in the back pocket for if/when the business model demands it. |
| **SQLAlchemy `before_insert`/`after_update` hooks (auto-emit)** | Coarse: hooks fire on row-level mutations but don't carry the actor or request context (who's doing this? what's the trace?). We'd have to thread context through `info` dicts in every session. Manual emission in the service layer is more explicit and survives refactors. |
| **Pure OTel trace attributes (no DB table)** | Traces are not queryable by entity. "Show me everything that happened to Skill X" can't be answered without a second store. Also requires a trace backend (Jaeger / SigNoz / Tempo) — events should work standalone in the Postgres dev setup. |
| **Separate event store (EventStoreDB / Kafka)** | New dependency for what is, in MVP, modest write volume (~hundreds of events/day per active graph). Postgres handles this fine. Revisit if write volume crosses ~100/s sustained. |
| **Emit on response middleware (after the route returns)** | Loses the writable session — emitting from middleware needs its own DB session, and now events can commit even if the state-change rolled back (or vice-versa). Service-layer emission shares the transaction with the state mutation, which is exactly the invariant we want. |

---

## Visibility / RBAC summary

| Surface | Auth | Scope |
| ------- | ---- | ----- |
| `GET /api/v1/events` | `require_superuser` | All events |
| `GET /api/v1/u/{username}/{graphSlug}/events` | `require_graph_member` | `graph_id = <resolved>` only |
| `/admin/events` (studio) | superuser-gated `UserMenu` link + route guard | all events |
| Graph rail Events icon + section | visible to any graph member | this graph's events only |

Actor display: when an event's `actor_id` resolves to a user the viewer can't see (e.g. a non-member acting on a graph), display `actor.username` only (or `system`); no email, no full name leak.

---

## Implementation plan

Three slices, each independently shippable. Per the docs-split memory, each completed slice → mark in `mvp.md` + corresponding layer doc.

### S-A — Events infrastructure (engine)
- [ ] New `engine/src/invana/events/` module (models, schemas, store, services, routes, actions).
- [ ] `events` table + Alembic 00000000000d.
- [ ] `emit_event` helper + `ActorType` enum + actions.py constants.
- [ ] `events_router` (global) + `graph_events_router` (per-graph). Auth gates per § Visibility.
- [ ] Register routers in `server/app.py`. starlette-admin view (per the existing rule).
- **Done when:** `POST /api/v1/u/.../skills` writes a `skill.create` event row; both `GET /api/v1/events` (superuser) and `GET /api/v1/u/.../events` (member) return it.

### S-B — Wire emit_event into existing services
- [ ] Graph CRUD (graphs/services.py).
- [ ] GraphConnection (PUT / DELETE / test / ping / introspect).
- [ ] LLM providers (CRUD + ping + set_default).
- [ ] Skills + Instructions (CRUD).
- [ ] Members + Invitations (add / role_change / remove / create / accept / delete).
- [ ] Setup wizard transitions.
- [ ] Auth events (register / login / logout / refresh / password_change / username_change).
- [ ] Query executions.
- [ ] System events (connection auto-reconnect, introspect completion).
- **Done when:** each domain write produces the matching event; manual walkthrough of the studio shows the new Events section populating in real time.

### S-C — Studio Events surfaces
- [ ] `studio/src/types/events.ts`, `services/api/events.ts`, `hooks/queries/useEvents.ts`, `hooks/useEventStream.ts` (SSE).
- [ ] `EventsSection` component (settings panel section + full-page maximize target `GraphEventsSettingsPage`).
- [ ] Rail icon (Activity) added to `useGraphLeftNav`; `events` added to `SettingsSection` type.
- [ ] `/platform/events` global page (superuser-gated via `RoleGate`); link in `UserMenu`.
- [ ] Filter bar + keyset pagination. SSE wired so the head of the list updates live; pagination state unaffected.
- **Done when:** rail icon opens the panel, new events appear at the top of the list within a couple of seconds of being emitted; platform page shows all events with the graph-filter dropdown.

### S-A scope additions (vs original draft)

- Add the `events_insert` trigger + `LISTEN events` daemon connection per worker.
- Add the two SSE endpoints (`.../events/stream` global + per-graph) alongside the paginated read endpoints.
- No pruning cron — audit logs are forever (§ Retention).

---

## Open questions

Resolved:

1. ~~Global page URL~~ — **`/platform/events`**. New `/platform/*` namespace dodges the starlette-admin collision and gives a clean prefix for future platform-admin surfaces.
2. ~~Detail capture depth~~ — **changed-keys diff only** for updates (`{changed: {field: {before, after}}}`); create/delete events keep a `{name: ...}` snapshot; sensitive fields always omitted. See § Decision summary.
3. ~~Query events sampling / retention~~ — **capture every query; never delete.** Events are an audit log; retention is forever. See § Retention.
4. ~~SSE / live tail~~ — **ship in v1.** Postgres `LISTEN/NOTIFY` driven, one daemon connection per worker. See § Live tail.
5. **Event for graph creation vs first graph_id** — confirmed not a chicken-and-egg: emission runs after the row is inserted, so `graph_id = new_graph.id` is set. Noted, no action.

Remaining / deferred:

6. **Cross-graph privacy on platform page**: if Graph A's events leak Graph B-member usernames via `actor.username` in a denormalised view that a superuser then shares — is that an issue? Superuser-only, low risk; flag it for ops policy.
7. **Webhook delivery / external subscribers**: deferred — clean to add later by tailing the events table (via the SSE endpoints) or via a small outbox pattern.
8. **MVP scope update**: this RFC pulls in a new Layer 2.x section (Events) — `mvp.md` to add `§ 2.11 Events` + a new slice (S5.5 sequenced between S5 and S6). Apply once the RFC is accepted.

---

## References

- RFC-007 (Telemetry) — OTel traces are the per-request signal; this RFC adds the per-entity signal. The two correlate via `trace_id`.
- RFC-017 (Graph as the Primary Container) — `graph_id` is the per-tenant scope used for the graph-filtered Events view.
- `docs/internal/mvp.md` — Layer 2 (graph-scoped resources). Update to add § 2.11 Events when this RFC is accepted.
- CLAUDE.md rule #1 (RFC-before-code) — why this exists before any engine module.
