# Schedules

Routine work that runs itself and lands where people read. A schedule names an **agent**, the
**instructions** it carries out, a **cron**, and where the result is **delivered**. Each occurrence
is a **firing**, recorded whether it ran or not.

| | |
|---|---|
| Index | [10.1](../../../README.md#10--operate) · Slice **B08** |
| Module | [Operate](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [notifications](notifications.md) · [approvals](approvals.md) · [see-what-ran](see-what-ran.md) · [instructions](../../skills/features/instructions-publish-rollback.md) · AG-42 |

Product spec: [AG-F07 · Schedules](../../../../../specs/capabilities/agents/features/AG-F07-schedules/feature.md) — AG-42; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| `schedules` | `graph_id` · `name` · `agent_id` · `instructions` · `cron` · `timezone` · `status (active · paused)` · `missed (catch_up · run_all · skip)` · `overlap (skip · allow)` · `deliver_in_app` · `recipient_ids[]` · `channel_ids[]` · `approve_outward` · `approver_ids[]` · `approval_deadline_s` · `next_fire_at` · `owner_id` |
| `schedule_firings` | `schedule_id` · `due_at` · `fired_at` · `outcome (queued · opened · skipped · failed)` · `catch_up` · `manual` · `run_id` · `reason` · `delivered_at` — unique `(schedule_id, due_at)` |
| Routes | `GET·POST …/schedules` · `GET·PATCH·DELETE …/schedules/{id}` · `POST …/schedules/{id}/pause · resume · run` · `GET …/schedules/{id}/firings` (tag `schedules`) |
| Events | `schedule.create · update · pause · resume · delete · fire · skip` |
| CLI | `invana schedules list · create --file · show · pause · resume · run-now · delete` |

## Decisions

Engine rows; the product decisions are AG-F07's.

| # | Decision |
|---|---|
| SC3 | `(schedule_id, due_at)` is unique, so two engine processes never fire one occurrence twice. |
