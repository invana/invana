# Pick a plan, or write one

The *Plan* step picks a published template by intent. Generation is what happens when nothing fits —
the fallback, not the default.

> ⚠ **Rewritten for orchestration § 0** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> task-model-migration.md.

| | |
|---|---|
| Index | [7.2](../../../README.md#7--workflows) · Slice **S9d** |
| Module | [Workflows](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 |
| Related | [the-library](the-library.md) · [envelope-validation](envelope-validation.md) · [promote-a-plan](promote-a-plan.md) |

Product spec: [AG-F06 · Plans and functions](../../../../../specs/capabilities/agents/features/AG-F06-plans-and-functions/feature.md) — AG-18; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| Matching | intent similarity over published versions, deterministic and recorded |
| Plan record | on the run: steps, origin (`selected:<version>` or `generated`) |
| Routes | internal to the runtime; visible through the trace |
| Events | `plan.selected · generated` |
