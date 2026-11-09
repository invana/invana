# Import and export agents and skills

People arrive with agents and skills already written for another agent system — Markdown with YAML
frontmatter for agents, Agent Skills folders for skills. The Agent Builder takes those files as they
are, maps every one, compiles each skill's plan, and refuses what cannot run before anything is saved.
Export writes the same files back, so what Invana holds stays portable.

| | |
|---|---|
| Index | [5.17](../../../README.md#5--agents) · Slice **S-TBD** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | 🔵 / 🔵 / 🔵 |
| Related | [the Agent Builder](install-wide-agents-and-skills.md) · [authoring a skill](../../skills/features/authoring-a-skill.md) (SK23–SK25) · [instructions, publish and roll back](../../skills/features/instructions-publish-rollback.md) · [evals](../../skills/features/evals.md) · products: agent-builder.md AB-05, AB-06 |

Product spec: [AG-F02 · The agents catalogue](../../../../../specs/capabilities/agents/features/AG-F02-the-agents-catalogue/feature.md) — AG-39 and AG-40; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Agent Builder › **Import and export** (`builder.import`) | The drop target, then *What came in*: file · kind · maps to · state; *Import n* · *Export all* |
| Agent Builder › **Add a library** (`builder.functions.library`) | The package and its docs, the proposed functions with inputs and outputs, *Approve* · *Edit* per row |
| A skill's page (`builder.skill`) | *Export* in the head |

## Engine

| Piece | Shape |
|---|---|
| `POST /api/v1/catalogue/import` (dry run) · `POST …/import/commit` | The dry run returns every file's mapping, refusals and proposed functions; commit saves drafts |
| `GET /api/v1/catalogue/agents/{id}/export` · `/skills/{id}/export` · `/export` | A zip of the standard files |
| `POST /api/v1/catalogue/libraries` · `POST …/functions/{id}/approve` | A library's proposed functions; approval registers each as a read-only function |
| CLI | `invana catalogue import <path> [--commit]` · `invana catalogue export [<name>]` |
