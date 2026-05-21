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
- **Manual emission via `emit_event(...)` helper** called from service-layer functions (not auto-magic SQLAlchemy hooks). Explicit, grep-able, lets us capture context (actor, request-time before/after diff) without per-table boilerplate.
- **Schema** carries `(graph_id?, actor_id?, actor_type, action, target_kind, target_id?, details JSONB, trace_id?, created_at)`. `graph_id` and `actor_id` are nullable so auth and system events fit the same row shape.
- **Read API:** `GET /api/v1/events` (superuser only, all events, paginated) and `GET /api/v1/u/{username}/{graphSlug}/events` (any graph member, scoped to that graph).
- **Write API:** none. Events are emitted only by the engine itself.
- **Studio:** new rail icon (Events) on every graph-scoped page; new full-page `/admin/events` (platform admin) reachable from `UserMenu`.
- **Retention:** time-bucketed per `action` category — admin-tunable via settings, default 90 days for most events, 14 days for `query.execute`.
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

- New top-level route `/settings/platform-events` (or `/admin/events` — see Open questions; the slash chosen will be the maximize target).
- Reachable from `UserMenu` → "Platform events" (RoleGate gates the menu item to `superuser`).
- Same component shape as `EventsSection` plus a `graph` filter dropdown (all graphs the platform has, since superuser).

---

## Retention

Events grow unbounded if untouched. Strategy:

- **Default 90 days** for most actions.
- **14 days** for `query.execute` (high volume, low individual value beyond recent debugging).
- **Forever** for security-sensitive actions: `auth.password_change`, `auth.username_change`, `member.role_change`, `member.remove`, `graph.delete`. (Configurable, but the default is "keep forever".)
- Implementation: a small daily cron (existing background-task setup or a simple SQL `DELETE WHERE created_at < ...` triggered from `invana.cli` per-action category) — deferred to its own slice; v1 ships without pruning.

Settings keys (under `invana.settings.AuditEvents`):

```
INVANA_AUDIT_RETENTION_DEFAULT_DAYS   default 90
INVANA_AUDIT_RETENTION_QUERY_DAYS     default 14
INVANA_AUDIT_RETENTION_SECURITY_DAYS  default 0  (0 = forever)
```

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
- [ ] `studio/src/types/events.ts`, `services/api/events.ts`, `hooks/queries/useEvents.ts`.
- [ ] `EventsSection` component (settings panel section + full-page maximize target `GraphEventsSettingsPage`).
- [ ] Rail icon (Activity) added to `useGraphLeftNav`; `events` added to `SettingsSection` type.
- [ ] `/admin/events` global page (superuser-gated via `RoleGate`); link in `UserMenu`.
- [ ] Filter bar + keyset pagination.
- **Done when:** rail icon opens the panel, events render newest-first with details expand; admin page shows all events with the graph-filter dropdown.

Retention pruning is deferred to its own follow-up (S-D — out of MVP).

---

## Open questions

1. **Global page URL**: `/admin/events` (under the App shell, gated by RoleGate) vs `/settings/platform-events` (sits with the other settings routes)? Leaning `/admin/events` since it's a superuser-only surface that parallels `/admin` (starlette-admin), but that namespace currently belongs to starlette-admin itself. Could land at `/platform/events` to dodge the collision.
2. **Event for graph creation vs first graph_id**: a `graph.create` event needs to live on the new graph. The emission happens after the row is inserted, so `graph_id = new_graph.id` works — confirming this is fine and not introducing a chicken-and-egg.
3. **Query events sampling**: 14-day retention defends storage; do we also want per-graph sampling (`store only 1 in N`)? Probably no for MVP — re-evaluate if any graph reaches >10k queries/day.
4. **SSE / live tail**: nice-to-have for the Events view ("new events appear as they happen"). Not in v1; polling on a 5-10s interval is fine.
5. **Cross-graph privacy on global page**: if Graph A's events leak Graph B-member usernames via `actor.username` in a denormalised view that a superuser then shares — is that an issue? Superuser-only, low risk; flag it for ops policy.
6. **Webhook delivery / external subscribers**: deferred — clean to add later by tailing the events table or via a small outbox pattern.
7. **MVP scope update**: this RFC pulls in a new Layer 2.x section (Events) — `mvp.md` to add `§ 2.11 Events` + a new slice (S2.5 or insert as parallel-to-S5 track). Decision: drop in after § 2.10 as **§ 2.11 Events** and sequence the implementation slice as **S5.5** (since S5 just shipped and S6 datasets is the next big slice).

---

## References

- RFC-007 (Telemetry) — OTel traces are the per-request signal; this RFC adds the per-entity signal. The two correlate via `trace_id`.
- RFC-017 (Graph as the Primary Container) — `graph_id` is the per-tenant scope used for the graph-filtered Events view.
- `docs/internal/mvp.md` — Layer 2 (graph-scoped resources). Update to add § 2.11 Events when this RFC is accepted.
- CLAUDE.md rule #1 (RFC-before-code) — why this exists before any engine module.
