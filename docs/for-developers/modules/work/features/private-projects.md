# Private projects

A project is visible to every member of its Graph, or only to the people and agents on it.

| | |
|---|---|
| Index | [9.7](../../../README.md#9--work) · B05 |
| Module | [Work](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Product | [PJ-F01 · Projects and tasks](../../../../../specs/capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md) · PJ-02 · P-14 |
| Related | [roles](../../identity-and-access/features/roles.md) · [search](../../platform/features/search.md) · [projects-and-tasks](projects-and-tasks.md) |

Product spec: [PJ-F01 · Projects and tasks](../../../../../specs/capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md) — PJ-02; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| `projects.visibility` | `graph` (default) · `private` |
| `ProjectManager.hidden_ids(graph_id, reader)` | The private projects a reader is not staffed on — the one query every read filters by |
| Applied in | project list · get by key · task list · task get · plan · decisions list · `SearchManager` |

## Decisions

Engine rows; the product decisions are PJ-F01's.

| # | Decision |
|---|---|
| PP6 | Agent runs read projects through their own principals; per-project access is enforced on the people-facing API, search and the Graph's event feed. |
