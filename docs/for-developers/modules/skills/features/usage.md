# Where a skill was used

Where a skill was **offered**, and where it was **reported applied**. The gap between the two is the
most useful number in the product.

| | |
|---|---|
| Index | [6.3](../../../README.md#6--skills) · Slice **S12c** |
| Module | [Skills](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [bindings](bindings.md) · evidence · proposals |

Product spec: [AG-F04 · Skills](../../../../../specs/capabilities/agents/features/AG-F04-skills/feature.md) — AG-30; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Surfaces

| Surface | Shape |
|---|---|
| Evidence page | The same gaps across all skills, ranked |
| **The Usage board** | `More` on the Usage tab opens a `kind = skill_usage` declared board: the tiles, per version, by agent, by outcome, the bounded step list, and the four readings of a gap ([US7](#decisions) · [US8](#decisions)) |

## Engine

| Thing | Shape |
|---|---|
| Source | `task_runs.skills_offered` and `.skills_applied` — **`skill_version_id`s**, never bare skill ids ([US3](#decisions) · [SK19](authoring-a-skill.md#decisions)) |
| Derivation | counted on read from the record; no separate store |
| The counts | SQL over every step in the Graph, per version — not over the window the step list pages through. A total taken from a page is a different number wearing the same label |
| The step list | bounded, newest first, each row naming the version it read |
| Bindings | read from `skill_bindings` ([BN6](bindings.md#decisions)), not by scanning the bindings |
| The floor | `MIN_OFFERS_TO_READ = 5` in `runtime/managers/skill_usage.py` — one constant behind every `enough_to_read` ([US6](#decisions)) |
| `by_outcome` | keyed by the **run's** outcome — `answered` · `cannot_answer` · `failed` · `cancelled` — for the current version only |
| Routes | `GET …/skills/{id}/usage` → `versions` · `by_agent` · `by_outcome` · `used_by` · `recent_steps` |

## Surfaces, as drawn

On [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc) — the rows not yet settled into AG-F04.

| Surface | Shape | Artboard |
|---|---|---|
| The migration | `v1` carries every step from before versions existed, and there is no *before versions* bucket ([US5](#decisions)) | `UsageVersions` |

## Decisions

Engine rows, and rows that stay until they are settled; the product decisions are AG-F04's.

| # | Decision |
|---|---|
| US2 | Usage is derived from the record, never accumulated in a counter. |
| US5 | **Counts before versions existed are v1's.** The migration rewrites every historical step to name v1 ([SK19](authoring-a-skill.md#decisions)), so there is no unattributed bucket and no *before versions* row on the surface. |
| US7 | **The Usage board is addressed by the skill, and the version is a view on it.** One read returns every published version ([US3](#decisions)), and the page's whole job is reading one count against the next — so a board per version would be seven boards each holding a seventh of one reading, and moving between them would open a tab. `subject_id` is the skill's id; the version rides the spec's segmented action, and the tiles redraw. What the surface still may never do is add versions together: 2,786 offers across seven texts is a number drawn nowhere. |
