# Audit and activity

Every write is an event, every actor is a principal, and causality is kept — so "who recommended what,
citing what, on whose behalf" has an answer rather than an opinion.

| | |
|---|---|
| Index | [10.2](../../../README.md#10--operate) · Slice **S5.5 · S12a** |
| Module | [Operate](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 |
| Related | [reasoning-trace](../../ask/features/reasoning-trace.md) · [lineage](../../agents/features/lineage.md) · [evidence](../../memory/features/evidence.md) |

Product spec: [IN-F03 · History](../../../../../specs/products/inbox/features/IN-F03-history/feature.md) — IN-02; the story, its criteria, journey, states and product decisions live there. This file keeps the Studio layout and the engine shape.

## Surfaces

| Surface | Shape |
|---|---|
| Activity | On the task, the agent and the Graph — the same tree, scoped |
| Activity › Events | The Graph's scope, as the `Events` tab of the shell's Activity page at `/u/:user/:graph/activity/events` ([O9](../spec.md#7-cross-feature-decisions)). The `Events` icon in `leftNav` opens it. It is the same timeline the Graph's settings carry, drawn full width |
| Live tail | Events streaming, filterable |
| Event row | A timeline entry: marker · when + actor, the verb on the line, the record on expand |

## Engine

| Thing | Shape |
|---|---|
| `events` | append-only: principal, `on_behalf_of`, verb, target, payload, `parent_event_id`, `trace_id`, `span_id`, time |
| Redaction | at write, by field name and by type |
| Activity | recursive query over events plus run steps |
| Retention | window-based purge, itself recorded |
| Routes | `GET …/events` (keyset) · `GET …/tasks/{id}/activity` · SSE for the tail |

## Decisions

| # | Decision |
|---|---|
| AA6 | Activity reads as a timeline, not a list of cards — `TimelineList variant="rail"` from `@invana/ui`, newest first. The rail's marker is a `StatusDot` toned by the event's derived outcome (`success` · `error` · `muted`), `when` carries the relative time and the actor, the verb is the entry's title, and the full record opens in place under it. `Load older` sits in the `TimelineFooter`, so the rail runs on into it — the line itself says the history continues past what is loaded. |
| AA7 | **An event's scope is a path, not a value, and it lives in `event_scopes` — `(event_id, scope_kind, scope_id)`, one row per scope.** An event belongs to a project *and* a task *and* a run at once, so no single `(scope_kind, scope_id)` pair on the event can carry it. The join table is unbounded, so an app that wants scoped events adds rows rather than a column to `core`, and it answers *every event on this thread* in one query — which is exactly what notification fan-out asks. `graph_id` stays a column on `events`: it is tenancy, not scope, it is present on nearly every emit, and every read filters on it. The cost is one join on the activity read and 1–3 extra rows per event. |
| AA8 | **An event carries the trace it was written in** — `trace_id` and `span_id`, filled by default at emit, so every write opens the action that caused it ([telemetry](../../platform/features/telemetry.md) TE13). A caller never passes it by hand. |
