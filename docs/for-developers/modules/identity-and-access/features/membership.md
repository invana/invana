# Membership

You are a member of a Graph, or you are not. A member reads everything in it; what they may change
is the [Graph roles](roles.md) they hold.

| | |
|---|---|
| Index | [11.4](../../../README.md#11--identity-and-access) · Slice **S1** · roles **B11** |
| Module | [Identity and access](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [roles](roles.md) · [sessions](sessions.md) · [projects-and-tasks](../../work/features/projects-and-tasks.md) · [envelope-and-budget](../../agents/features/envelope-and-budget.md) |

Product spec: [ST-F01 · This graph](../../../../../specs/foundation/settings/features/ST-F01-this-graph/feature.md) — ST-12; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape, the CLI and the rows not moved.

## Surfaces

| Surface | Shape |
|---|---|
| CLI | `invana members list · add · set-roles · remove --graph <user>/<slug>` |

## Engine

| Thing | Shape |
|---|---|
| `graph_members` | `graph_id` · `user_id` · `roles` · `created_at` |
| Guard | membership and roles resolved per request, never from a token claim |
| Routes | `GET · POST …/members` · `PATCH · DELETE …/members/{member}` · `GET …/access` |
| Events | `member.add · remove · roles` |

## Decisions

| # | Decision |
|---|---|
| MB5 | Agents are principals, not members. |
